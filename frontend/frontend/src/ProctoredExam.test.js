import { fireEvent, render, screen } from "@testing-library/react";
import { StudentDashboard } from "./App";

const questions = Array.from({ length: 50 }, (_, index) => ({
  id: `IQ-${String(index + 1).padStart(3, "0")}`,
  text: `Question ${index + 1}`,
  options: ["A", "B", "C", "D"].map((letter) => ({
    id: letter,
    text: `Question ${index + 1} answer ${letter}`,
  })),
}));

const baseProps = {
  studentData: { submissions: [], certificates: { badges: [] } },
  isTakingExam: false,
  examType: "IQ",
  setExamType: jest.fn(),
  questions: [],
  currentQuestionIndex: 0,
  questionDeadline: 0,
  answers: {},
  onAnswerChange: jest.fn(),
  onAdvanceQuestion: jest.fn(),
  tabSwitches: 0,
  isLoading: false,
  socket: { connected: true },
  liveSessionId: "",
  onCameraChange: jest.fn(),
  onCameraFailure: jest.fn(),
  onStartExam: jest.fn(),
  onSubmitExam: jest.fn(),
  cameraReady: false,
};

test("requires an enabled camera before allowing a student to start", async () => {
  const { rerender } = render(<StudentDashboard {...baseProps} />);

  expect(screen.getByRole("button", { name: "Begin assessment" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Enable camera" }));
  await screen.findByText(/Camera access requires a supported browser/);
  expect(screen.getByRole("button", { name: "Begin assessment" })).toBeDisabled();

  rerender(
    <StudentDashboard
      {...baseProps}
      cameraReady
      onCameraChange={jest.fn()}
      onStartExam={jest.fn()}
    />
  );
  expect(screen.getByRole("button", { name: "Begin assessment" })).toBeEnabled();
});

test("shows one timed question at a time and advances after the minute expires", () => {
  const onAdvanceQuestion = jest.fn();
  const { container } = render(
    <StudentDashboard
      {...baseProps}
      isTakingExam
      questions={questions}
      questionDeadline={Date.now() - 1}
      onAdvanceQuestion={onAdvanceQuestion}
      cameraReady
    />
  );

  expect(container.querySelectorAll("fieldset.question-card")).toHaveLength(1);
  expect(screen.getByText("00:00")).toBeInTheDocument();
  expect(onAdvanceQuestion).toHaveBeenCalledTimes(1);
});
