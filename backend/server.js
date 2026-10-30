import "./config/loadEnv.js";
import { createServer } from "node:http";
import app, { allowedOrigins } from "./app.js";
import connectDB from "./config/db.js";
import { seedAdminUser } from "./controllers/authController.js";
import { attachLiveExamSocket } from "./services/liveExamSocket.js";

const port = process.env.PORT || 9999;
const httpServer = createServer(app);
const io = attachLiveExamSocket(httpServer, allowedOrigins);
app.set("io", io);

const startServer = async () => {
  try {
    if (
      !process.env.JWT_SECRET ||
      process.env.JWT_SECRET.length < 32 ||
      /^(replace-with|change-this-secret)/i.test(process.env.JWT_SECRET)
    ) {
      throw new Error("Set JWT_SECRET to a unique random value of at least 32 characters.");
    }

    await connectDB();
    await seedAdminUser();

    httpServer.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
