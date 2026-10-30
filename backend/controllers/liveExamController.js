import { randomUUID } from "node:crypto";
import {
  activeLiveExams,
  closeLiveExamSession,
  startingLiveExamStudents,
} from "../services/liveExamSessions.js";
import {
  EXAM_QUESTION_COUNT,
  QUESTION_TIME_LIMIT_MS,
  selectExamQuestions,
} from "../services/examQuestions.js";
import User from "../models/User.js";

const publicQuestion = ({ correctOptionId, ...question }) => question;
const publicSession = ({ sessionId, studentId, studentName, examType, startedAt, reviewerJoined }) => ({
  sessionId,
  studentId,
  studentName,
  examType,
  startedAt,
  reviewerJoined,
});

const getQuestionTimeRemaining = (session) =>
  session.questionStartedAt === null
    ? QUESTION_TIME_LIMIT_MS
    : Math.max(0, QUESTION_TIME_LIMIT_MS - (Date.now() - session.questionStartedAt));

export const createLiveExam = async (req, res) => {
  const { examType } = req.body;
  if (!["IQ", "EQ"].includes(examType)) {
    return res.status(400).json({ message: "examType must be IQ or EQ." });
  }

  const studentId = String(req.user._id);
  if (
    startingLiveExamStudents.has(studentId) ||
    [...activeLiveExams.values()].some((exam) => exam.studentId === studentId)
  ) {
    return res.status(409).json({ message: "Finish your current proctored exam before starting another." });
  }

  startingLiveExamStudents.add(studentId);
  try {
    const historyField = examType === "IQ" ? "usedIQQuestionIds" : "usedEQQuestionIds";
    const student = await User.findById(req.user._id).select(`+${historyField}`);
    if (!student) {
      return res.status(401).json({ message: "User not found." });
    }

    const selection = selectExamQuestions(examType, student[historyField]);
    if (!selection || selection.selectedQuestions.length !== EXAM_QUESTION_COUNT) {
      throw new Error(`Unable to select ${EXAM_QUESTION_COUNT} questions for ${examType}.`);
    }

    await User.updateOne(
      { _id: req.user._id },
      { $set: { [historyField]: selection.nextUsedQuestionIds } }
    );

    const sessionId = randomUUID();
    const questionStartedAt = Date.now();
    const session = {
      sessionId,
      studentId,
      studentName: req.user.name,
      examType,
      questions: selection.selectedQuestions,
      answers: [],
      currentQuestionIndex: 0,
      questionStartedAt: null,
      startedAt: new Date().toISOString(),
      lastSeenAt: questionStartedAt,
      reviewerJoined: false,
    };

    activeLiveExams.set(sessionId, session);
    req.app.get("io").to("reviewers").emit("exam:active", publicSession(session));
    return res.status(201).json({
      sessionId,
      startedAt: session.startedAt,
      question: publicQuestion(session.questions[0]),
      questionIndex: 0,
      questionCount: EXAM_QUESTION_COUNT,
      questionTimeRemainingMs: getQuestionTimeRemaining(session),
    });
  } catch (error) {
    console.error("Unable to start live exam:", error);
    return res.status(500).json({ message: "Unable to start assessment." });
  } finally {
    startingLiveExamStudents.delete(studentId);
  }
};

export const advanceLiveExamQuestion = (req, res) => {
  const session = activeLiveExams.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ message: "Live exam not found or already ended." });
  }

  if (session.studentId !== String(req.user._id)) {
    return res.status(403).json({ message: "You cannot answer another student's live exam." });
  }

  const { questionIndex, answer } = req.body;
  if (
    !Number.isInteger(questionIndex) ||
    (answer !== undefined && answer !== null && typeof answer !== "string")
  ) {
    return res.status(400).json({ message: "Provide a valid question index and optional answer." });
  }

  if (
    questionIndex === session.currentQuestionIndex - 1 &&
    session.lastAdvanceResult
  ) {
    const result = { ...session.lastAdvanceResult };
    if (!result.complete) {
      result.questionTimeRemainingMs = getQuestionTimeRemaining(session);
    }
    return res.json(result);
  }

  if (questionIndex !== session.currentQuestionIndex) {
    return res.status(409).json({ message: "This question has already ended." });
  }

  if (session.questionStartedAt === null) {
    return res.status(409).json({ message: "Join live proctoring before answering questions." });
  }

  const question = session.questions[session.currentQuestionIndex];
  if (!question) {
    return res.status(409).json({ message: "All questions have already been completed." });
  }

  if (
    answer !== undefined &&
    answer !== null &&
    !question.options.some((option) => option.id === answer)
  ) {
    return res.status(400).json({ message: "Select one of the available answer choices." });
  }

  const timedOut = Date.now() - session.questionStartedAt >= QUESTION_TIME_LIMIT_MS;
  const acceptedAnswer = !timedOut && typeof answer === "string" ? answer : undefined;
  session.answers.push({
    questionId: question.id,
    question: question.text,
    options: question.options.map(({ id, text }) => ({ id, text })),
    ...(acceptedAnswer ? { answer: acceptedAnswer } : {}),
  });
  session.currentQuestionIndex += 1;
  session.lastSeenAt = Date.now();

  if (session.currentQuestionIndex === EXAM_QUESTION_COUNT) {
    session.lastAdvanceResult = {
      complete: true,
      timedOut,
      answerAccepted: Boolean(acceptedAnswer),
      questionIndex: session.currentQuestionIndex,
      questionCount: EXAM_QUESTION_COUNT,
    };
    return res.json(session.lastAdvanceResult);
  }

  session.questionStartedAt = Date.now();
  session.lastAdvanceResult = {
    complete: false,
    timedOut,
    answerAccepted: Boolean(acceptedAnswer),
    question: publicQuestion(session.questions[session.currentQuestionIndex]),
    questionIndex: session.currentQuestionIndex,
    questionCount: EXAM_QUESTION_COUNT,
    questionTimeRemainingMs: getQuestionTimeRemaining(session),
  };
  req.app.get("io").to("reviewers").emit("exam:active", publicSession(session));
  return res.json(session.lastAdvanceResult);
};

export const getLiveExams = (req, res) => {
  const liveExams = [...activeLiveExams.values()]
    .filter((exam) => Date.now() - exam.lastSeenAt < 90_000)
    .map(publicSession);
  return res.json({ liveExams });
};

export const endLiveExam = (req, res) => {
  const session = activeLiveExams.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ message: "Live exam not found or already ended." });
  }

  if (session.studentId !== String(req.user._id)) {
    return res.status(403).json({ message: "You cannot end another student's live exam." });
  }

  const endedSession = closeLiveExamSession(req.app.get("io"), req.params.sessionId);
  return res.json({
    reviewerJoined: endedSession.reviewerJoined,
    startedAt: endedSession.startedAt,
  });
};
