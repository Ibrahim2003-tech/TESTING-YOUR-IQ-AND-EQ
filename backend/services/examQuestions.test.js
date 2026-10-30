import assert from "node:assert/strict";
import test from "node:test";
import {
  examFailureReasons,
  EXAM_QUESTION_COUNT,
  getExamQuestions,
  selectExamQuestions,
  validateExamAnswers,
} from "./examQuestions.js";
import ExamSubmission from "../models/ExamSubmission.js";

test("publishes 50 questions and four answer choices for each exam without answer keys", () => {
  for (const examType of ["IQ", "EQ"]) {
    const questions = getExamQuestions(examType);

    assert.equal(questions.length, 50);
    assert.equal(new Set(questions.map((question) => question.id)).size, 50);
    for (const question of questions) {
      assert.equal(question.options.length, 4);
      assert.ok(question.text.length > 10);
      assert.ok(question.options.every((option) => option.id && option.text));
      assert.equal(new Set(question.options.map((option) => option.text)).size, 4);
      assert.equal("correctOptionId" in question, false);
    }
  }
});

test("accepts exactly 50 unique selectable answers", () => {
  const questions = getExamQuestions("IQ");
  const answers = questions.map((question) => ({
    questionId: question.id,
    answer: question.options[0].id,
  }));

  assert.equal(validateExamAnswers("IQ", answers, false), null);
});

test("provides thousands of distinct generated questions for each assessment type", () => {
  for (const examType of ["IQ", "EQ"]) {
    const { selectedQuestions } = selectExamQuestions(examType, [], 2000);
    assert.equal(selectedQuestions.length, 2000);
    assert.equal(new Set(selectedQuestions.map((question) => question.id)).size, 2000);
    assert.equal(new Set(selectedQuestions.map((question) => question.text)).size, 2000);
  }
});

test("selects 50 questions without repeating a student's question history before cycling", () => {
  for (const examType of ["IQ", "EQ"]) {
    const firstAttempt = selectExamQuestions(examType);
    const secondAttempt = selectExamQuestions(examType, firstAttempt.nextUsedQuestionIds);

    assert.equal(firstAttempt.selectedQuestions.length, EXAM_QUESTION_COUNT);
    assert.equal(secondAttempt.selectedQuestions.length, EXAM_QUESTION_COUNT);
    assert.equal(
      firstAttempt.selectedQuestions.some((question) =>
        secondAttempt.selectedQuestions.some((nextQuestion) => nextQuestion.id === question.id)
      ),
      false
    );
  }
});

test("requires every answer and rejects duplicated, unknown, and invalid choices", () => {
  const questions = getExamQuestions("EQ");
  const answers = questions.map((question) => ({
    questionId: question.id,
    answer: question.options[0].id,
  }));

  assert.match(validateExamAnswers("EQ", answers.slice(0, 49), false), /all 50/);
  assert.match(validateExamAnswers("EQ", [...answers.slice(0, 49), answers[0]], false), /invalid/);
  assert.match(
    validateExamAnswers("EQ", [...answers.slice(0, 49), { questionId: "EQ-050", answer: "X" }], false),
    /invalid/
  );
  assert.equal(validateExamAnswers("EQ", answers.slice(0, 1), true), null);
});

test("allows a completed timed assessment to contain unanswered timed-out questions", () => {
  const { selectedQuestions } = selectExamQuestions("IQ");
  const answers = selectedQuestions.map((question, index) => ({
    questionId: question.id,
    ...(index % 2 === 0 ? { answer: question.options[0].id } : {}),
  }));

  assert.equal(validateExamAnswers("IQ", answers, false, selectedQuestions), null);
});

test("only recognizes the configured proctoring-failure reasons", () => {
  assert.deepEqual(examFailureReasons, [
    "tab_hidden",
    "window_blur",
    "screenshot_shortcut",
    "camera_stopped",
    "camera_disconnected",
  ]);
});

test("allows an exam to be marked failed before the student answers any questions", () => {
  const failedSubmission = new ExamSubmission({
    userId: "507f1f77bcf86cd799439011",
    examType: "IQ",
    answers: [],
    status: "Failed",
    failureReason: "window_blur",
    tabSwitches: 1,
  });
  const incompleteSubmission = new ExamSubmission({
    userId: "507f1f77bcf86cd799439011",
    examType: "IQ",
    answers: [],
    status: "Pending_Review",
    tabSwitches: 0,
  });

  assert.equal(failedSubmission.validateSync(), undefined);
  assert.ok(incompleteSubmission.validateSync().errors.answers);
});

test("stores question snapshots and permits unanswered questions in completed submissions", () => {
  const submission = new ExamSubmission({
    userId: "507f1f77bcf86cd799439011",
    examType: "EQ",
    answers: Array.from({ length: 50 }, (_, index) => ({
      questionId: `EQ-${index + 1}`,
      question: `Scenario ${index + 1}`,
      options: [{ id: "A", text: "Listen and clarify." }],
      ...(index % 2 === 0 ? { answer: "A" } : {}),
    })),
    status: "Pending_Review",
    tabSwitches: 0,
  });

  assert.equal(submission.validateSync(), undefined);
});
