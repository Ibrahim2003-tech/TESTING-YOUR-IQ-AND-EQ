import { getExamQuestions } from "../services/examQuestions.js";

export const getQuestions = (req, res) => {
  const { examType } = req.query;
  const questions = getExamQuestions(examType);
  if (!questions) {
    return res.status(400).json({ message: "examType must be IQ or EQ." });
  }

  return res.json({ examType, questions });
};
