import express from "express";
import {
  listWorkflowDefinitions, getRuns, getRunById,
  triggerSpeakerCancellation, triggerSponsorPerformance, triggerVenueIssue, triggerHighCrowd,
  approveRun, rejectRun,
} from "../controllers/workflow.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/workflows", requireAuth, requireAdmin, listWorkflowDefinitions);
router.get("/workflows/runs", requireAuth, requireAdmin, getRuns);
router.get("/workflows/runs/:id", requireAuth, requireAdmin, getRunById);
router.post("/workflows/speaker-cancellation", requireAuth, requireAdmin, triggerSpeakerCancellation);
router.post("/workflows/sponsor-performance", requireAuth, requireAdmin, triggerSponsorPerformance);
router.post("/workflows/venue-issue", requireAuth, requireAdmin, triggerVenueIssue);
router.post("/workflows/high-crowd", requireAuth, requireAdmin, triggerHighCrowd);
router.post("/workflows/runs/:id/approve", requireAuth, requireAdmin, approveRun);
router.post("/workflows/runs/:id/reject", requireAuth, requireAdmin, rejectRun);

export default router;
