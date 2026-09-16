import express from "express";
import { getIntelligenceOverview, getIntelligenceInsights, getAiExecutiveBriefing } from "../controllers/intelligence.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/intelligence/overview", requireAuth, requireAdmin, getIntelligenceOverview);
router.get("/intelligence/insights", requireAuth, requireAdmin, getIntelligenceInsights);
router.post("/intelligence/ai-briefing", requireAuth, requireAdmin, getAiExecutiveBriefing);

export default router;
