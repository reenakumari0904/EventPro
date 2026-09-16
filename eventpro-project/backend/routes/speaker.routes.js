import express from "express";
import {
  createSpeaker, getSpeakers, updateSpeaker, deleteSpeaker, checkSpeakerAvailability, aiSuggestSpeaker,
  autoScheduleSpeakers, getSpeakerSchedulingAnalytics,
} from "../controllers/speaker.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/speakers", requireAuth, requireAdmin, createSpeaker);
router.get("/speakers", requireAuth, requireAdmin, getSpeakers);
router.put("/speakers/:id", requireAuth, requireAdmin, updateSpeaker);
router.delete("/speakers/:id", requireAuth, requireAdmin, deleteSpeaker);
router.get("/speakers/:id/availability", requireAuth, requireAdmin, checkSpeakerAvailability);
router.post("/speakers/ai-suggest", requireAuth, requireAdmin, aiSuggestSpeaker);
router.post("/speakers/auto-schedule", requireAuth, requireAdmin, autoScheduleSpeakers);
router.get("/speakers/scheduling-analytics", requireAuth, requireAdmin, getSpeakerSchedulingAnalytics);

export default router;