import express from "express";
import { checkInAttendee, getCheckinSummary } from "../controllers/checkin.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/checkin", requireAuth, requireAdmin, checkInAttendee);
router.get("/checkin/summary", requireAuth, requireAdmin, getCheckinSummary);

export default router;