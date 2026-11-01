import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import ProctorCamera, { LiveReviewerFeed } from "./ProctorCamera";
import { connectLiveSocket } from "./liveSocket";

const API_URL =
  process.env.NODE_ENV === "production"
    ? ""
    : process.env.REACT_APP_API_URL || "http://localhost:9999";
const SOCKET_URL =
  process.env.REACT_APP_API_URL || "https://testing-your-iq-and-eq.onrender.com";

const requestApi = async (path, { method = "GET", body, csrfToken } = {}) => {
  const headers = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (csrfToken && method !== "GET") {
    headers["X-CSRF-Token"] = csrfToken;
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      credentials: "include",
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "Cannot reach the assessment service. Start the backend and confirm its database connection."
      );
    }
    throw error;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (!response.ok) {
    const error = new Error(data.message || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }

  return data;
};

const getCsrfToken = async () => {
  const data = await requestApi("/api/auth/csrf-token");
  return data.csrfToken;
};

const formatDate = (date) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(date)
  );

function App() {
  const [credentials, setCredentials] = useState({ email: "", password: "", name: "" });
  const [isRegistering, setIsRegistering] = useState(false);
  const [csrfToken, setCsrfToken] = useState("");
  const [user, setUser] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [pendingExams, setPendingExams] = useState([]);
  const [activeLiveExams, setActiveLiveExams] = useState([]);
  const [socket, setSocket] = useState(null);
  const [mediaStream, setMediaStream] = useState(null);
  const [isTakingExam, setIsTakingExam] = useState(false);
  const [examType, setExamType] = useState("IQ");
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionDeadline, setQuestionDeadline] = useState(0);
  const [answers, setAnswers] = useState({});
  const [liveSessionId, setLiveSessionId] = useState("");
  const [tabSwitches, setTabSwitches] = useState(0);
  const [reviewScores, setReviewScores] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const isFinalizingRef = useRef(false);
  const hasRecordedViolationRef = useRef(false);
  const answersRef = useRef({});
  const isAdvancingQuestionRef = useRef(false);
  const submitExamRef = useRef(null);
  const userId = user?._id;
  const userRole = user?.role;

  const isReviewer = user?.role === "admin" || user?.role === "reviewer";

  const loadRoleData = useCallback(async (currentUser) => {
    if (currentUser.role === "admin" || currentUser.role === "reviewer") {
      const [data, liveData] = await Promise.all([
        requestApi("/api/exams/pending"),
        requestApi("/api/exams/live-sessions"),
      ]);
      setPendingExams(data.submissions);
      setActiveLiveExams(liveData.liveExams);
      setStudentData(null);
    } else {
      const data = await requestApi("/api/exams/mine");
      setStudentData(data);
      setPendingExams([]);
      setActiveLiveExams([]);
    }
  }, []);

  useEffect(() => {
    if (!userRole) {
      setSocket(null);
      return undefined;
    }

    let active = true;
    const connection = connectLiveSocket(SOCKET_URL, {
      auth: (callback) => {
        requestApi("/api/auth/socket-token")
          .then(({ socketToken }) => callback({ token: socketToken }))
          .catch((connectionError) => {
            if (active) {
              setError(connectionError.message || "Unable to connect to live proctoring.");
            }
            callback({});
          });
      },
      withCredentials: true,
      autoConnect: false,
    });
    const updateLiveSession = (session) => {
      setActiveLiveExams((current) => [
        ...current.filter((item) => item.sessionId !== session.sessionId),
        session,
      ]);
    };
    const removeLiveSession = ({ sessionId } = {}) => {
      if (sessionId) {
        setActiveLiveExams((current) =>
          current.filter((session) => session.sessionId !== sessionId)
        );
      }
    };

    if (userRole === "admin" || userRole === "reviewer") {
      connection.on("exam:active", updateLiveSession);
      connection.on("exam:ended", removeLiveSession);
    }
    connection.on("connect_error", (connectionError) => {
      setError(connectionError.message || "Unable to connect to live proctoring.");
    });
    setSocket(connection);
    connection.connect();

    return () => {
      active = false;
      connection.disconnect();
      setSocket((current) => (current === connection ? null : current));
    };
  }, [userId, userRole]);

  useEffect(() => {
    if (!isReviewer || !user) return undefined;
    const refresh = () => loadRoleData(user).catch((loadError) => setError(loadError.message));
    const timer = window.setInterval(refresh, 10000);
    return () => window.clearInterval(timer);
  }, [isReviewer, loadRoleData, user]);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      try {
        const token = await getCsrfToken();
        if (!active) return;
        setCsrfToken(token);

        const data = await requestApi("/api/auth/session");
        if (!active) return;
        if (data.user) {
          setUser(data.user);
          await loadRoleData(data.user);
        }
      } catch (sessionError) {
        if (active) {
          setError(sessionError.message || "Unable to connect to the assessment service.");
        }
      }
    };

    restoreSession();
    return () => {
      active = false;
    };
  }, [loadRoleData]);

  useEffect(() => {
    if (!isTakingExam) return undefined;

    let hasLeftPage = false;
    const recordInfraction = () => {
      if (!hasLeftPage) {
        hasLeftPage = true;
        setTabSwitches((count) => count + 1);
      }
    };
    const handleViolation = (reason) => {
      if (hasRecordedViolationRef.current || isFinalizingRef.current) return;
      hasRecordedViolationRef.current = true;
      recordInfraction();
      submitExamRef.current?.(undefined, reason);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        handleViolation("tab_hidden");
      } else {
        hasLeftPage = false;
      }
    };
    const handleBlur = () => handleViolation("window_blur");
    const handleShortcut = (event) => {
      const screenshotShortcut =
        event.key === "PrintScreen" ||
        ((event.ctrlKey || event.metaKey) &&
          event.shiftKey &&
          ["s", "3", "4", "5"].includes(event.key.toLowerCase()));
      if (screenshotShortcut) {
        event.preventDefault();
        handleViolation("screenshot_shortcut");
      }
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("keydown", handleShortcut);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("keydown", handleShortcut);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isTakingExam]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    setNotice("");

    try {
      const token = await getCsrfToken();
      setCsrfToken(token);
      const data = await requestApi("/api/auth/login", {
        method: "POST",
        csrfToken: token,
        body: { email: credentials.email, password: credentials.password },
      });
      setUser(data.user);
      await loadRoleData(data.user);
    } catch (loginError) {
      setError(loginError.message || "Unable to sign in.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegistration = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    setNotice("");

    try {
      const token = await getCsrfToken();
      setCsrfToken(token);
      const data = await requestApi("/api/auth/register", {
        method: "POST",
        csrfToken: token,
        body: credentials,
      });
      setIsRegistering(false);
      setCredentials((current) => ({ ...current, password: "" }));
      setNotice(data.message);
    } catch (registrationError) {
      setError(registrationError.message || "Unable to create your account.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    setError("");

    try {
      await requestApi("/api/auth/logout", { method: "POST", csrfToken });
      setUser(null);
      setStudentData(null);
      setPendingExams([]);
      setActiveLiveExams([]);
      setMediaStream(null);
      setQuestions([]);
      setCurrentQuestionIndex(0);
      setQuestionDeadline(0);
      setAnswers({});
      setLiveSessionId("");
      setIsTakingExam(false);
      setNotice("");
    } catch (logoutError) {
      setError(logoutError.message || "Unable to sign out.");
    } finally {
      setIsLoading(false);
    }
  };

  const startExam = async () => {
    setError("");
    setNotice("");
    setTabSwitches(0);
    setAnswers({});
    answersRef.current = {};
    hasRecordedViolationRef.current = false;
    setCurrentQuestionIndex(0);
    setQuestionDeadline(0);

    if (!mediaStream?.getVideoTracks().some((track) => track.readyState === "live")) {
      setError("Turn on your camera before starting the assessment.");
      return;
    }

    if (!socket?.connected) {
      setError("Live proctoring is connecting. Wait a moment and try again.");
      return;
    }

    let createdSessionId = "";
    setIsLoading(true);
    try {
      const session = await requestApi("/api/exams/live-sessions", {
        method: "POST",
        csrfToken,
        body: { examType },
      });
      createdSessionId = session.sessionId;

      const joinResult = await new Promise((resolve, reject) => {
        socket.timeout(5000).emit(
          "exam:join",
          { sessionId: session.sessionId },
          (connectionError, result) => {
            if (connectionError || result?.error) {
              reject(new Error(result?.error || "Unable to connect to live proctoring."));
            } else {
              resolve(result);
            }
          }
        );
      });

      if (joinResult?.error) {
        throw new Error(joinResult.error);
      }

      setQuestions([session.question]);
      setCurrentQuestionIndex(0);
      setQuestionDeadline(Date.now() + joinResult.questionTimeRemainingMs);
      setLiveSessionId(session.sessionId);
      setIsTakingExam(true);
    } catch (startError) {
      let message = startError.message || "Unable to start the assessment.";
      if (createdSessionId) {
        try {
          await requestApi(`/api/exams/live-sessions/${createdSessionId}`, {
            method: "DELETE",
            csrfToken,
          });
        } catch (cleanupError) {
          message = `${message} The live session could not be closed: ${cleanupError.message}`;
        }
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const submitExam = async (event, failureReason) => {
    event?.preventDefault();
    if (isFinalizingRef.current || !liveSessionId) return;
    isFinalizingRef.current = true;

    setIsLoading(true);
    setError("");

    try {
      const data = await requestApi("/api/exams/submit", {
        method: "POST",
        csrfToken,
        body: {
          examType,
          tabSwitches: failureReason ? Math.max(tabSwitches + 1, 1) : tabSwitches,
          liveSessionId,
          ...(failureReason &&
          questions[currentQuestionIndex] &&
          answersRef.current[questions[currentQuestionIndex].id]
            ? { currentAnswer: answersRef.current[questions[currentQuestionIndex].id] }
            : {}),
          ...(failureReason ? { failureReason } : {}),
        },
      });
      setNotice(data.message);
      setIsTakingExam(false);
      setLiveSessionId("");
      setQuestionDeadline(0);
      setCurrentQuestionIndex(0);
      setAnswers({});
      answersRef.current = {};
      setQuestions([]);
      setMediaStream(null);
      mediaStream?.getTracks().forEach((track) => track.stop());
      await loadRoleData(user);
    } catch (submitError) {
      if (failureReason) hasRecordedViolationRef.current = false;
      setError(submitError.message || "Unable to submit your assessment.");
    } finally {
      isFinalizingRef.current = false;
      setIsLoading(false);
    }
  };
  submitExamRef.current = submitExam;

  const advanceQuestion = useCallback(async () => {
    if (
      isAdvancingQuestionRef.current ||
      isFinalizingRef.current ||
      !liveSessionId ||
      !questions[currentQuestionIndex]
    ) {
      return;
    }

    isAdvancingQuestionRef.current = true;
    const currentQuestion = questions[currentQuestionIndex];
    const selectedAnswer = answersRef.current[currentQuestion.id];
    setIsLoading(true);
    setError("");

    try {
      const result = await requestApi(`/api/exams/live-sessions/${liveSessionId}/answer`, {
        method: "POST",
        csrfToken,
        body: {
          questionIndex: currentQuestionIndex,
          answer: selectedAnswer || null,
        },
      });

      if (!result.answerAccepted) {
        const nextAnswers = { ...answersRef.current };
        delete nextAnswers[currentQuestion.id];
        answersRef.current = nextAnswers;
        setAnswers(nextAnswers);
      }

      if (result.complete) {
        setCurrentQuestionIndex(result.questionIndex);
        isAdvancingQuestionRef.current = false;
        await submitExamRef.current?.();
        return;
      }

      setQuestions((current) => [...current, result.question]);
      setCurrentQuestionIndex(result.questionIndex);
      setQuestionDeadline(Date.now() + result.questionTimeRemainingMs);
    } catch (advanceError) {
      setError(advanceError.message || "Unable to move to the next question.");
    } finally {
      isAdvancingQuestionRef.current = false;
      setIsLoading(false);
    }
  }, [currentQuestionIndex, csrfToken, liveSessionId, questions]);

  const handleAnswerChange = (questionId, answer) => {
    const nextAnswers = { ...answersRef.current, [questionId]: answer };
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
  };

  const handleCameraFailure = (reason) => {
    if (isTakingExam) {
      submitExam(undefined, reason);
    }
  };

  const reviewExam = async (submission, status) => {
    setIsLoading(true);
    setError("");
    setNotice("");

    try {
      const score = reviewScores[submission._id];
      const body = { status };
      if (status === "Approved") {
        if (score === undefined || score === "" || !Number.isFinite(Number(score))) {
          throw new Error("Enter a final score from 0 to 100 before approving.");
        }
        body.finalScore = Number(score);
      }

      const data = await requestApi(`/api/exams/review/${submission._id}`, {
        method: "PUT",
        csrfToken,
        body,
      });
      setNotice(data.message);
      await loadRoleData(user);
    } catch (reviewError) {
      setError(reviewError.message || "Unable to review this assessment.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <main className="app-shell">
        <section className="auth-panel">
          <div className="brand-block">
            <span className="eyebrow">Assessment & Certification</span>
            <h1>Think clearly.<br />Grow confidently.</h1>
            <p>
              Submit an assessment, follow its review, and view your certificates when they are approved.
            </p>
            <div className="trust-note">
              <span className="trust-dot" />
              Private student accounts · Human-reviewed results
            </div>
          </div>

          <form onSubmit={isRegistering ? handleRegistration : handleLogin} className="login-form">
            <div>
              <span className="eyebrow">Welcome</span>
              <h2>{isRegistering ? "Create student account" : "Sign in"}</h2>
              <p className="muted-copy">
                {isRegistering
                  ? "Your account is created with the student role."
                  : "Sign in to continue to your assessment portal."}
              </p>
            </div>

            {isRegistering && (
              <label>
                Full name
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={credentials.name}
                  onChange={(event) =>
                    setCredentials((current) => ({ ...current, name: event.target.value }))
                  }
                  autoComplete="name"
                  minLength={2}
                  maxLength={80}
                  required
                />
              </label>
            )}

            <label>
              Email
              <input
                id="email"
                name="email"
                type="email"
                value={credentials.email}
                onChange={(event) =>
                  setCredentials((current) => ({ ...current, email: event.target.value }))
                }
                autoComplete="email"
                required
              />
            </label>

            <label>
              Password
              <input
                id="password"
                name="password"
                type="password"
                value={credentials.password}
                onChange={(event) =>
                  setCredentials((current) => ({ ...current, password: event.target.value }))
                }
                autoComplete={isRegistering ? "new-password" : "current-password"}
                minLength={isRegistering ? 8 : undefined}
                required
              />
              {isRegistering && <small>Use at least 8 characters.</small>}
            </label>

            {error && <div className="error-box" role="alert">{error}</div>}
            {notice && <div className="success-box" role="status">{notice}</div>}

            <button type="submit" disabled={isLoading}>
              {isLoading
                ? "Please wait..."
                : isRegistering
                  ? "Create account"
                  : "Sign in"}
            </button>

            <p className="form-switch">
              {isRegistering ? "Already registered?" : "New to the portal?"}{" "}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setIsRegistering((current) => !current);
                  setError("");
                  setNotice("");
                }}
              >
                {isRegistering ? "Sign in" : "Create a student account"}
              </button>
            </p>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell app-shell-top">
      <section className="dashboard-panel">
        <header className="topbar">
          <div className="brand-small">
            <span className="brand-mark">A</span>
            <div>
              <span className="eyebrow">Assessment Portal</span>
              <h1>{isReviewer ? "Review workspace" : "My learning dashboard"}</h1>
            </div>
          </div>
          <div className="account-actions">
            <span className="role-badge">{user.role}</span>
            <button
              className="logout-btn"
              onClick={handleLogout}
              disabled={isLoading || isTakingExam}
              title={isTakingExam ? "Complete or fail the active assessment before signing out." : undefined}
            >
              Sign out
            </button>
          </div>
        </header>

        <section className="welcome-strip">
          <div>
            <p className="muted-copy">Signed in as</p>
            <h2>{user.name}</h2>
            <span>{user.email}</span>
          </div>
          <div className="welcome-stat">
            <span className="status-dot" />
            <span>{isReviewer ? `${pendingExams.length} awaiting review` : "Account protected"}</span>
          </div>
        </section>

        {error && <div className="error-box page-message" role="alert">{error}</div>}
        {notice && <div className="success-box page-message" role="status">{notice}</div>}

        {isReviewer ? (
          <section className="workspace-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Live proctoring</span>
                <h2>Students taking assessments</h2>
              </div>
              <span className="type-chip">{activeLiveExams.length} live</span>
            </div>

            {activeLiveExams.length ? (
              <div className="review-list">
                {activeLiveExams.map((session) => (
                  <article className="review-card live-session-card" key={session.sessionId}>
                    <div className="review-card-heading">
                      <div>
                        <span className="type-chip">{session.examType} assessment</span>
                        <h3>{session.studentName}</h3>
                        <p>Started {formatDate(session.startedAt)}</p>
                      </div>
                      <span className="pending-pill">Live</span>
                    </div>
                    <LiveReviewerFeed socket={socket} session={session} />
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state compact-empty">
                <p>No students are currently taking a live assessment.</p>
              </div>
            )}

            <div className="section-heading review-queue-heading">
              <div>
                <span className="eyebrow">Reviewer queue</span>
                <h2>Submitted assessments</h2>
              </div>
              <button
                type="button"
                className="text-button"
                onClick={() => loadRoleData(user).catch((loadError) => setError(loadError.message))}
              >
                Refresh queue
              </button>
            </div>

            {pendingExams.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">✓</span>
                <h3>Queue is clear</h3>
                <p>New student submissions will appear here for review.</p>
              </div>
            ) : (
              <div className="review-list">
                {pendingExams.map((submission) => (
                  <article className="review-card" key={submission._id}>
                    <div className="review-card-heading">
                      <div>
                        <span className="type-chip">{submission.examType} assessment</span>
                        <h3>{submission.user?.name || "Student"}</h3>
                        <p>{submission.user?.email}</p>
                      </div>
                      <span className="pending-pill">
                        {submission.failureReason ? "Auto-failed" : "Pending review"}
                      </span>
                    </div>

                    <div className="review-stats">
                      <div><span>Submitted</span><strong>{formatDate(submission.submittedAt)}</strong></div>
                      <div><span>Focus changes</span><strong>{submission.tabSwitches}</strong></div>
                      <div>
                        <span>Live reviewer</span>
                        <strong>{submission.proctoring?.reviewerJoined ? "Joined" : "Not joined"}</strong>
                      </div>
                    </div>

                    <div className="answer-review">
                      <span className="field-caption">
                        Student answers ({submission.answers.length}/50)
                      </span>
                      {submission.failureReason && (
                        <p className="warning-box">
                          This exam failed automatically ({submission.failureReason.replaceAll("_", " ")}).
                        </p>
                      )}
                      {submission.answers.map((item) => (
                        <div className="review-answer" key={item.questionId}>
                          <strong>{item.questionId}. {item.question}</strong>
                          <p>
                            {item.options.find((option) => option.id === item.answer)?.text ||
                              "No answer recorded"}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="review-actions">
                      {!submission.failureReason && (
                        <label>
                          Final score
                          <input
                            id={`score-${submission._id}`}
                            name={`score-${submission._id}`}
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={reviewScores[submission._id] ?? ""}
                            onChange={(event) =>
                              setReviewScores((current) => ({
                                ...current,
                                [submission._id]: event.target.value,
                              }))
                            }
                            placeholder="0–100"
                          />
                        </label>
                      )}
                      <div className="decision-buttons">
                        {!submission.failureReason && (
                          <button
                            type="button"
                            className="approve-button"
                            onClick={() => reviewExam(submission, "Approved")}
                            disabled={isLoading}
                          >
                            Approve & certify
                          </button>
                        )}
                        <button
                          type="button"
                          className="reject-button"
                          onClick={() => reviewExam(submission, "Rejected")}
                          disabled={isLoading}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                    <p className="review-disclaimer">
                      Video was streamed live and not recorded. Browser focus and screenshot detection are best-effort.
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : (
          <StudentDashboard
            studentData={studentData}
            isTakingExam={isTakingExam}
            examType={examType}
            setExamType={setExamType}
            questions={questions}
            currentQuestionIndex={currentQuestionIndex}
            questionDeadline={questionDeadline}
            answers={answers}
            onAnswerChange={handleAnswerChange}
            onAdvanceQuestion={advanceQuestion}
            tabSwitches={tabSwitches}
            isLoading={isLoading}
            socket={socket}
            liveSessionId={liveSessionId}
            onCameraChange={setMediaStream}
            onCameraFailure={handleCameraFailure}
            onStartExam={startExam}
            onSubmitExam={submitExam}
            cameraReady={mediaStream?.getVideoTracks().some((track) => track.readyState === "live")}
          />
        )}

        <footer className="page-footer">
          Assessments are manually reviewed. This starter portal does not provide validated IQ or EQ testing.
        </footer>
      </section>
    </main>
  );
}

export function StudentDashboard({
  studentData,
  isTakingExam,
  examType,
  setExamType,
  questions,
  currentQuestionIndex,
  questionDeadline,
  answers,
  onAnswerChange,
  onAdvanceQuestion,
  tabSwitches,
  isLoading,
  socket,
  liveSessionId,
  onCameraChange,
  onCameraFailure,
  onStartExam,
  onSubmitExam,
  cameraReady,
}) {
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const advanceQuestionRef = useRef(onAdvanceQuestion);
  const hasAutoAdvancedRef = useRef(false);
  const submissions = studentData?.submissions || [];
  const certificates = studentData?.certificates;
  const isPending = submissions.some((submission) => submission.status === "Pending_Review");
  const badges = certificates?.badges || [];
  const currentQuestion = questions[currentQuestionIndex];

  useEffect(() => {
    advanceQuestionRef.current = onAdvanceQuestion;
  }, [onAdvanceQuestion]);

  useEffect(() => {
    hasAutoAdvancedRef.current = false;
  }, [questionDeadline]);

  useEffect(() => {
    if (!isTakingExam || !questionDeadline || currentQuestionIndex >= 50) return undefined;

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((questionDeadline - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining === 0 && !hasAutoAdvancedRef.current) {
        hasAutoAdvancedRef.current = true;
        advanceQuestionRef.current();
      }
    };

    updateTimer();
    const timer = window.setInterval(updateTimer, 200);
    return () => window.clearInterval(timer);
  }, [currentQuestionIndex, isTakingExam, questionDeadline]);

  return (
    <div className="student-dashboard">
      {isPending && (
        <section className="pending-banner" role="status">
          <span className="pending-banner-icon">◷</span>
          <div>
            <strong>Review pending</strong>
            <p>Your submitted assessment is waiting for a reviewer. Results unlock after approval.</p>
          </div>
        </section>
      )}

      <section className="certificate-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Your achievements</span>
            <h2>Certificates & badges</h2>
          </div>
        </div>
        <div className="certificate-grid">
          {[
            ["IQ", certificates?.highestIQScore],
            ["EQ", certificates?.highestEQScore],
          ].map(([type, score]) => (
            <article className={`certificate-card ${score === null || score === undefined ? "locked" : ""}`} key={type}>
              <span className="certificate-symbol">{score === null || score === undefined ? "◇" : "✦"}</span>
              <div>
                <span className="field-caption">{type} CERTIFICATE</span>
                <h3>{score === null || score === undefined ? "Not yet unlocked" : `${score} / 100`}</h3>
                <p>{score === null || score === undefined ? "Earned after an approved assessment." : "Verified by a portal reviewer."}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="badge-row">
          <span className="field-caption">BADGES</span>
          {badges.length ? (
            badges.map((badge) => <span className="badge-chip" key={badge}>✦ {badge}</span>)
          ) : (
            <span className="muted-copy">No badges yet</span>
          )}
        </div>
      </section>

      <section className="assessment-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Assessment center</span>
            <h2>{isTakingExam ? "Assessment in progress" : "Start an assessment"}</h2>
          </div>
        </div>

        <div className={`assessment-grid ${isTakingExam ? "" : "assessment-prep-grid"}`}>
          {isTakingExam ? (
            <section className="assessment-form" aria-label="Timed assessment">
              <div className="focus-indicator">
                <span className="status-dot" />
                Question {Math.min(currentQuestionIndex + 1, 50)} / 50
                <span> · Questions answered: <strong>{Object.keys(answers).length} / 50</strong></span>
                <span> · Focus changes: <strong>{tabSwitches}</strong></span>
              </div>
              <div className="warning-box" role="alert">
                Leaving the exam tab or switching windows fails this exam. Screenshot detection is best-effort and cannot block every capture method.
              </div>

              {currentQuestion ? (
                <form
                  className="timed-question-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onAdvanceQuestion();
                  }}
                >
                  <div className="question-timer" role="status" aria-live="off">
                    <span>Time for this question</span>
                    <strong>
                      {`${String(Math.floor(secondsRemaining / 60)).padStart(2, "0")}:${String(
                        secondsRemaining % 60
                      ).padStart(2, "0")}`}
                    </strong>
                  </div>
                  <fieldset
                    className="question-card"
                    disabled={isLoading || secondsRemaining === 0}
                  >
                    <legend>
                      <span className="question-number">Question {currentQuestionIndex + 1}</span>
                      {currentQuestion.text}
                    </legend>
                    <div className="question-options">
                      {currentQuestion.options.map((option) => (
                        <label className="question-option" key={option.id}>
                          <input
                            type="radio"
                            id={`answer-${currentQuestion.id}-${option.id}`}
                            name={currentQuestion.id}
                            value={option.id}
                            checked={answers[currentQuestion.id] === option.id}
                            onChange={() => onAnswerChange(currentQuestion.id, option.id)}
                          />
                          <span className="option-letter">{option.id}</span>
                          <span>{option.text}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <p className="privacy-note">
                    Each question has one minute. When time runs out, unanswered questions are skipped and cannot be revisited. Your video is live-streamed to a reviewer and is not recorded.
                  </p>
                  <button type="submit" disabled={isLoading}>
                    {isLoading
                      ? "Saving..."
                      : secondsRemaining === 0
                        ? "Retry moving on"
                        : currentQuestionIndex === 49
                          ? "Finish assessment"
                          : answers[currentQuestion.id]
                            ? "Next question"
                            : "Skip question"}
                  </button>
                </form>
              ) : (
                <div className="empty-state">
                  <h3>All 50 questions are complete</h3>
                  <p>Submit your assessment to send your answers for review.</p>
                  <button type="button" onClick={onSubmitExam} disabled={isLoading}>
                    {isLoading ? "Submitting..." : "Submit assessment"}
                  </button>
                </div>
              )}
            </section>
          ) : (
            <div className="start-assessment-card">
              <div className="assessment-icon">↗</div>
              <div>
                <h3>Choose a track and begin</h3>
                <p>
                  Each assessment contains 50 multiple-choice questions with one minute per question. When time runs out, the test moves on and you cannot return to that question. Your camera and the live proctoring connection are required to begin.
                </p>
                {!socket?.connected && (
                  <p className="inline-error" role="status">Connecting to live proctoring...</p>
                )}
              </div>
              <label>
                Assessment type
                <select
                  id="exam-type"
                  name="examType"
                  value={examType}
                  onChange={(event) => setExamType(event.target.value)}
                  disabled={isLoading}
                >
                  <option value="IQ">IQ assessment</option>
                  <option value="EQ">EQ assessment</option>
                </select>
              </label>
              <button
                type="button"
                onClick={onStartExam}
                disabled={isLoading || !cameraReady || !socket?.connected}
              >
                {isLoading ? "Starting..." : "Begin assessment"}
              </button>
            </div>
          )}
          <ProctorCamera
            isExamActive={isTakingExam}
            liveSessionId={liveSessionId}
            onCameraChange={onCameraChange}
            onCameraFailure={onCameraFailure}
            socket={socket}
          />
        </div>
      </section>

      <section className="history-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Progress</span>
            <h2>Assessment history</h2>
          </div>
        </div>
        {submissions.length ? (
          <div className="history-list">
            {submissions.map((submission) => (
              <div className="history-row" key={submission._id}>
                <div>
                  <span className="type-chip">{submission.examType}</span>
                  <strong>{formatDate(submission.submittedAt)}</strong>
                </div>
                <span className={`history-status ${submission.status.toLowerCase()}`}>
                  {submission.status === "Failed" ? "failed" : submission.status.replace("_", " ")}
                </span>
                {submission.status === "Approved" && (
                  <strong className="history-score">{submission.finalScore} / 100</strong>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <p>Your submitted assessments will appear here.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default App;
