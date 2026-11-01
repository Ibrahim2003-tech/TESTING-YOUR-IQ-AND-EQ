import express from "express";
import {
  getCurrentUser,
  getSession,
  getSocketToken,
  loginUser,
  logoutUser,
  registerUser,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/api/auth/csrf-token", (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

router.post("/api/auth/login", loginUser);
router.post("/api/auth/register", registerUser);
router.post("/api/auth/logout", logoutUser);
router.get("/api/auth/session", getSession);
router.get("/api/auth/me", protect, getCurrentUser);
router.get("/api/auth/socket-token", protect, getSocketToken);

export default router;
