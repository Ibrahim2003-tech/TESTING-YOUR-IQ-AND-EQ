import mongoose from "mongoose";
import ExamSubmission from "../models/ExamSubmission.js";
import User from "../models/User.js";
import { getExamQuestion, validateExamAnswers } from "../services/examQuestions.js";
import { activeLiveExams, closeLiveExamSession } from "../services/liveExamSessions.js";

const isHttpsUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};

export const submitExam = async (req, res) => {
  const { examType, tabSwitches, snapshots = [], failureReason, liveSessionId, currentAnswer } =
    req.body;

  if (!["IQ", "EQ"].includes(examType)) {
    return res.status(400).json({ message: "examType must be IQ or EQ." });
  }

  const session = activeLiveExams.get(liveSessionId);
  if (
    typeof liveSessionId !== "string" ||
    !session ||
    session.studentId !== String(req.user._id) ||
    session.examType !== examType
  ) {
    return res.status(409).json({ message: "Your live camera session is missing or has ended." });
  }

  if (
    (failureReason !== undefined &&
      !["tab_hidden", "window_blur", "screenshot_shortcut", "camera_stopped", "camera_disconnected"].includes(
        failureReason
      )) ||
    (currentAnswer !== undefined &&
      currentAnswer !== null &&
      typeof currentAnswer !== "string")
  ) {
    return res.status(400).json({ message: "Provide a valid optional answer and failure reason." });
  }

  if (!failureReason && session.currentQuestionIndex !== session.questions.length) {
    return res.status(409).json({ message: "Complete all questions before submitting." });
  }

  const answers = [...session.answers];
  if (
    failureReason &&
    currentAnswer &&
    session.currentQuestionIndex < session.questions.length &&
    Date.now() - session.questionStartedAt < 60_000
  ) {
    const currentQuestion = session.questions[session.currentQuestionIndex];
    if (!currentQuestion.options.some((option) => option.id === currentAnswer)) {
      return res.status(400).json({ message: "Select one of the available answer choices." });
    }
    answers.push({
      questionId: currentQuestion.id,
      question: currentQuestion.text,
      options: currentQuestion.options.map(({ id, text }) => ({ id, text })),
      answer: currentAnswer,
    });
  }

  const answerValidationError = validateExamAnswers(
    examType,
    answers,
    Boolean(failureReason),
    session.questions
  );
  if (answerValidationError) {
    return res.status(400).json({ message: answerValidationError });
  }

  if (!Number.isInteger(tabSwitches) || tabSwitches < 0 || tabSwitches > 10000) {
    return res.status(400).json({ message: "tabSwitches must be a non-negative integer." });
  }

  if (
    !Array.isArray(snapshots) ||
    snapshots.length > 10 ||
    snapshots.some((snapshot) => typeof snapshot !== "string" || snapshot.length > 2048 || !isHttpsUrl(snapshot))
  ) {
    return res.status(400).json({ message: "Snapshots must be up to 10 valid HTTPS image URLs." });
  }

  try {
    const submission = await ExamSubmission.create({
      userId: req.user._id,
      examType,
      answers,
      snapshots,
      tabSwitches,
      status: failureReason ? "Failed" : "Pending_Review",
      failureReason: failureReason || null,
      proctoring: {
        cameraUsed: true,
        reviewerJoined: session.reviewerJoined,
        startedAt: new Date(session.startedAt),
        endedAt: new Date(),
      },
    });

    closeLiveExamSession(req.app.get("io"), liveSessionId);
    await User.updateOne(
      { _id: req.user._id },
      { $set: { lastExamTaken: submission.submittedAt } }
    );

    return res.status(201).json({
      submission: {
        _id: submission._id,
        examType: submission.examType,
        status: submission.status,
        tabSwitches: submission.tabSwitches,
        submittedAt: submission.submittedAt,
        failureReason: submission.failureReason,
      },
      message: failureReason
        ? "Exam failed because a proctoring rule was triggered."
        : "Exam submitted for review.",
    });
  } catch (error) {
    console.error("Exam submission failed:", error);
    return res.status(500).json({ message: "Unable to submit exam." });
  }
};

export const getMyExams = async (req, res) => {
  try {
    const submissions = await ExamSubmission.find({ userId: req.user._id })
      .sort({ submittedAt: -1 })
      .select("examType status finalScore submittedAt tabSwitches failureReason");

    return res.json({
      submissions: submissions.map((submission) => ({
        _id: submission._id,
        examType: submission.examType,
        status: submission.status,
        submittedAt: submission.submittedAt,
        tabSwitches: submission.tabSwitches,
        ...(submission.failureReason ? { failureReason: submission.failureReason } : {}),
        ...(submission.status === "Approved" ? { finalScore: submission.finalScore } : {}),
      })),
      certificates: {
        highestIQScore: req.user.highestIQScore,
        highestEQScore: req.user.highestEQScore,
        badges: req.user.badges,
        lastExamTaken: req.user.lastExamTaken,
      },
    });
  } catch (error) {
    console.error("Unable to load exam history:", error);
    return res.status(500).json({ message: "Unable to load exam history." });
  }
};

export const getPendingExams = async (req, res) => {
  try {
    const submissions = await ExamSubmission.find({ status: { $in: ["Pending_Review", "Failed"] } })
      .populate("userId", "name email")
      .sort({ submittedAt: 1 });

    return res.json({
      submissions: submissions.map((submission) => ({
        _id: submission._id,
        user: submission.userId,
        examType: submission.examType,
        answers: submission.answers.map((item) => {
          const question = getExamQuestion(submission.examType, item.questionId);
          return {
            questionId: item.questionId,
            question: item.question ?? question?.text ?? "Question no longer available.",
            options: item.options ?? question?.options ?? [],
            answer: item.answer,
          };
        }),
        snapshots: submission.snapshots,
        tabSwitches: submission.tabSwitches,
        failureReason: submission.failureReason,
        proctoring: submission.proctoring,
        submittedAt: submission.submittedAt,
        status: submission.status,
      })),
    });
  } catch (error) {
    console.error("Unable to load pending exams:", error);
    return res.status(500).json({ message: "Unable to load pending exams." });
  }
};

export const reviewExam = async (req, res) => {
  const { id } = req.params;
  const { status, finalScore } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid exam submission ID." });
  }

  if (!["Approved", "Rejected"].includes(status)) {
    return res.status(400).json({ message: "status must be Approved or Rejected." });
  }

  if (
    (status === "Approved" && (typeof finalScore !== "number" || !Number.isFinite(finalScore) || finalScore < 0 || finalScore > 100)) ||
    (status === "Rejected" && finalScore !== undefined)
  ) {
    return res.status(400).json({
      message: "Approved submissions require a score from 0 to 100; rejected submissions cannot include a score.",
    });
  }

  try {
    const existingSubmission = await ExamSubmission.findOne({
      _id: id,
      status: { $in: ["Pending_Review", "Failed"] },
    }).select("failureReason status");

    if (!existingSubmission) {
      const exists = await ExamSubmission.exists({ _id: id });
      return res.status(exists ? 409 : 404).json({
        message: exists ? "This exam has already been reviewed." : "Exam submission not found.",
      });
    }

    if (status === "Approved" && existingSubmission.failureReason) {
      return res.status(409).json({
        message: "Failed assessments cannot be approved or certified.",
      });
    }

    const submission = await ExamSubmission.findOneAndUpdate(
      { _id: id, status: existingSubmission.status },
      {
        $set: {
          status,
          finalScore: status === "Approved" ? finalScore : null,
          reviewedAt: new Date(),
          reviewedBy: req.user._id,
        },
      },
      { new: true, runValidators: true }
    );

    if (!submission) {
      const exists = await ExamSubmission.exists({ _id: id });
      return res.status(exists ? 409 : 404).json({
        message: exists ? "This exam has already been reviewed." : "Exam submission not found.",
      });
    }

    if (status === "Approved") {
      const scoreField = submission.examType === "IQ" ? "highestIQScore" : "highestEQScore";
      const badge = `${submission.examType} Certified`;
      await User.updateOne(
        { _id: submission.userId },
        {
          $max: { [scoreField]: finalScore },
          $addToSet: { badges: badge },
        }
      );
    }

    return res.json({
      submission: {
        _id: submission._id,
        examType: submission.examType,
        status: submission.status,
        finalScore: submission.finalScore,
        reviewedAt: submission.reviewedAt,
      },
      message: `Exam ${status.toLowerCase()}.`,
    });
  } catch (error) {
    console.error("Exam review failed:", error);
    return res.status(500).json({ message: "Unable to review exam." });
  }
};
