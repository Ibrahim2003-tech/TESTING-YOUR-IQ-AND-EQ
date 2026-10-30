import assert from "node:assert/strict";
import test from "node:test";
import { advanceLiveExamQuestion } from "./liveExamController.js";
import { activeLiveExams } from "../services/liveExamSessions.js";

const createRequest = (sessionId, studentId, body) => ({
  params: { sessionId },
  user: { _id: studentId },
  body,
  app: { get: () => ({ to: () => ({ emit: () => {} }) }) },
});

const createResponse = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
});

test("records an answer before the question deadline and advances to the next item", () => {
  const sessionId = "test-live-exam-accepted-answer";
  const studentId = "507f1f77bcf86cd799439011";
  activeLiveExams.set(sessionId, {
    sessionId,
    studentId,
    currentQuestionIndex: 0,
    questionStartedAt: Date.now(),
    lastSeenAt: Date.now(),
    answers: [],
    questions: Array.from({ length: 50 }, (_, index) => ({
      id: `IQ-${index + 1}`,
      text: `Question ${index + 1}`,
      options: [
        { id: "A", text: "Choice A" },
        { id: "B", text: "Choice B" },
      ],
      correctOptionId: "A",
    })),
  });
  const response = createResponse();

  advanceLiveExamQuestion(
    createRequest(sessionId, studentId, { questionIndex: 0, answer: "B" }),
    response
  );

  const session = activeLiveExams.get(sessionId);
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.answerAccepted, true);
  assert.equal(response.payload.question.id, "IQ-2");
  assert.equal(session.currentQuestionIndex, 1);
  assert.equal(session.answers[0].answer, "B");
  assert.equal("correctOptionId" in response.payload.question, false);
  activeLiveExams.delete(sessionId);
});

test("discards answers received after the server-side deadline", () => {
  const sessionId = "test-live-exam-expired-answer";
  const studentId = "507f1f77bcf86cd799439011";
  activeLiveExams.set(sessionId, {
    sessionId,
    studentId,
    currentQuestionIndex: 0,
    questionStartedAt: Date.now() - 60_001,
    lastSeenAt: Date.now(),
    answers: [],
    questions: Array.from({ length: 50 }, (_, index) => ({
      id: `EQ-${index + 1}`,
      text: `Question ${index + 1}`,
      options: [{ id: "A", text: "Choice A" }],
      correctOptionId: "A",
    })),
  });
  const response = createResponse();

  advanceLiveExamQuestion(
    createRequest(sessionId, studentId, { questionIndex: 0, answer: "A" }),
    response
  );

  const session = activeLiveExams.get(sessionId);
  assert.equal(response.payload.timedOut, true);
  assert.equal(response.payload.answerAccepted, false);
  assert.equal("answer" in session.answers[0], false);
  assert.equal(session.currentQuestionIndex, 1);
  activeLiveExams.delete(sessionId);
});
