import { parse } from "cookie";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import User from "../models/User.js";
import { activeLiveExams } from "./liveExamSessions.js";
import { QUESTION_TIME_LIMIT_MS } from "./examQuestions.js";

const publicSession = ({ sessionId, studentId, studentName, examType, startedAt, reviewerJoined }) => ({
  sessionId,
  studentId,
  studentName,
  examType,
  startedAt,
  reviewerJoined,
});

export const attachLiveExamSocket = (httpServer, allowedOrigins) => {
  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
    transports: ["websocket"],
  });

  io.use(async (socket, next) => {
    try {
      const token = parse(socket.handshake.headers.cookie || "").token;
      if (!token) {
        return next(new Error("Authentication required."));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("name role");
      if (!user) {
        return next(new Error("Authentication required."));
      }

      socket.data.user = { id: String(user._id), name: user.name, role: user.role };
      return next();
    } catch {
      return next(new Error("Authentication required."));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    socket.data.examSessions = new Set();
    if (user.role === "admin" || user.role === "reviewer") {
      socket.join("reviewers");
      for (const session of activeLiveExams.values()) {
        if (Date.now() - session.lastSeenAt < 90_000) {
          socket.emit("exam:active", publicSession(session));
        }
      }
    }

    socket.on("exam:join", (payload = {}, acknowledge) => {
      const sessionId = payload?.sessionId;
      const reply = typeof acknowledge === "function" ? acknowledge : () => {};
      const session = activeLiveExams.get(sessionId);
      if (
        !session ||
        !["student", "analyst"].includes(user.role) ||
        session.studentId !== user.id
      ) {
        reply({ error: "Live exam not found." });
        return;
      }

      session.lastSeenAt = Date.now();
      if (session.questionStartedAt === null) {
        session.questionStartedAt = Date.now();
        session.startedAt = new Date(session.questionStartedAt).toISOString();
      }
      socket.data.examSessions.add(sessionId);
      socket.join(`exam:${sessionId}`);
      io.to("reviewers").emit("exam:active", publicSession(session));
      reply({
        sessionId,
        reviewerJoined: session.reviewerJoined,
        questionTimeRemainingMs: Math.max(
          0,
          QUESTION_TIME_LIMIT_MS - (Date.now() - session.questionStartedAt)
        ),
      });
    });

    socket.on("reviewer:join", (payload = {}, acknowledge) => {
      const sessionId = payload?.sessionId;
      const reply = typeof acknowledge === "function" ? acknowledge : () => {};
      const session = activeLiveExams.get(sessionId);
      if (
        !session ||
        !["admin", "reviewer"].includes(user.role) ||
        Date.now() - session.lastSeenAt >= 90_000
      ) {
        reply({ error: "Live exam is no longer available." });
        return;
      }

      session.reviewerJoined = true;
      socket.data.examSessions.add(sessionId);
      socket.join(`exam:${sessionId}`);
      socket.to(`exam:${sessionId}`).emit("reviewer:joined", {
        sessionId,
        reviewerName: user.name,
      });
      io.to("reviewers").emit("exam:active", publicSession(session));
      reply({ sessionId });
    });

    socket.on("rtc:signal", (payload = {}) => {
      const sessionId = payload?.sessionId;
      const signal = payload?.signal;
      if (
        typeof sessionId !== "string" ||
        !activeLiveExams.has(sessionId) ||
        !socket.data.examSessions.has(sessionId) ||
        !signal ||
        !["offer", "answer", "candidate"].includes(signal.type)
      ) {
        return;
      }

      socket.to(`exam:${sessionId}`).emit("rtc:signal", { sessionId, signal });
    });

    socket.on("exam:heartbeat", (payload = {}) => {
      const sessionId = payload?.sessionId;
      const session = activeLiveExams.get(sessionId);
      if (
        session &&
        session.studentId === user.id &&
        socket.data.examSessions.has(sessionId)
      ) {
        session.lastSeenAt = Date.now();
        io.to("reviewers").emit("exam:active", publicSession(session));
      }
    });
  });

  return io;
};
