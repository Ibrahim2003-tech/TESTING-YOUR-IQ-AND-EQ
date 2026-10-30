import express from "express";
import {
  getMyExams,
  getPendingExams,
  reviewExam,
  submitExam,
} from "../controllers/examController.js";
import { getQuestions } from "../controllers/examQuestionController.js";
import {
  createLiveExam,
  advanceLiveExamQuestion,
  endLiveExam,
  getLiveExams,
} from "../controllers/liveExamController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/api/exams/questions", protect, authorize("student", "analyst"), getQuestions);
router.post("/api/exams/live-sessions", protect, authorize("student", "analyst"), createLiveExam);
router.post(
  "/api/exams/live-sessions/:sessionId/answer",
  protect,
  authorize("student", "analyst"),
  advanceLiveExamQuestion
);
router.get("/api/exams/live-sessions", protect, authorize("admin", "reviewer"), getLiveExams);
router.delete("/api/exams/live-sessions/:sessionId", protect, authorize("student", "analyst"), endLiveExam);
router.post("/api/exams/submit", protect, authorize("student", "analyst"), submitExam);
router.get("/api/exams/mine", protect, authorize("student", "analyst"), getMyExams);
router.get("/api/exams/pending", protect, authorize("admin", "reviewer"), getPendingExams);
router.put("/api/exams/review/:id", protect, authorize("admin", "reviewer"), reviewExam);

export default router;
