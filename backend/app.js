import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import csrf from "csurf";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import authRoutes from "./routes/authRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import examRoutes from "./routes/examRoutes.js";

const app = express();
app.set("trust proxy", 1);

export const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://testing-your-iq-and-eq.vercel.app",
  ...(process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
].filter((value, index, array) => value && array.indexOf(value) === index);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
  })
);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "http://localhost:9999", "ws://localhost:9999", "https:", "wss:"],
      },
    },
    noSniff: true,
    xssFilter: true,
    frameguard: { action: "deny" },
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use((req, res, next) => {
  for (const key of ["body", "params", "headers", "query"]) {
    const value = req[key];
    if (value) {
      mongoSanitize.sanitize(value);
      if (key === "query") {
        Object.defineProperty(req, key, {
          value,
          configurable: true,
          writable: true,
        });
      }
    }
  }
  next();
});
app.use(xss());
app.use(cookieParser());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests from this IP, please try again later.",
  },
});

app.use("/api", apiLimiter);
app.use(csrf({ cookie: true }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(employeeRoutes);
app.use(examRoutes);

app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).json({ message: "CSRF validation failed" });
  }

  console.error(err);
  return res.status(500).json({ message: "Internal server error" });
});

export default app;
