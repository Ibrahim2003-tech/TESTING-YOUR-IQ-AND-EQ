export const activeLiveExams = new Map();
export const startingLiveExamStudents = new Set();

export const closeLiveExamSession = (io, sessionId) => {
  const session = activeLiveExams.get(sessionId);
  if (!session) return null;

  activeLiveExams.delete(sessionId);
  io.to(`exam:${sessionId}`).emit("exam:ended");
  io.to("reviewers").emit("exam:ended", { sessionId });
  return session;
};
