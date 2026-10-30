import express from "express";
import { authorize, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/api/dashboard/overview", protect, authorize("admin", "analyst"), (req, res) => {
  const summary = {
    company: "SecureOps Command Center",
    user: req.user.name,
    role: req.user.role,
    metrics: [
      { label: "Active incidents", value: 42, trend: "+12%" },
      { label: "Protected endpoints", value: 264, trend: "+8%" },
      { label: "Threat blocks", value: 1893, trend: "+41%" },
      { label: "Uptime", value: "99.98%", trend: "+0.3%" },
    ],
    alerts: [
      "Firewall rules updated for edge protection.",
      "Two suspicious login attempts blocked.",
      "Zero critical vulnerabilities in the current build.",
    ],
    tasks: [
      { id: 1, title: "Patch access policy review", status: "In review", owner: "Security Team" },
      { id: 2, title: "Load balancer health check", status: "Completed", owner: "Infra Team" },
      { id: 3, title: "Rate limit validation", status: "Running", owner: "Platform Team" },
    ],
  };

  res.json(summary);
});

export default router;
