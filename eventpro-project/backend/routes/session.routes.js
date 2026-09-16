import express from "express";
import {
  createSession, getSessions, getSessionAnalytics,
  rescheduleSession, recordSessionAttendance, submitSessionFeedback,
} from "../controllers/session.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/sessions", requireAuth, requireAdmin, createSession);
router.get("/sessions", requireAuth, requireAdmin, getSessions);
router.get("/sessions/analytics", requireAuth, requireAdmin, getSessionAnalytics);
router.put("/sessions/:id/reschedule", requireAuth, requireAdmin, rescheduleSession);
router.post("/sessions/:id/attendance", requireAuth, requireAdmin, recordSessionAttendance);
router.post("/sessions/:id/feedback", requireAuth, requireAdmin, submitSessionFeedback);

export default router;