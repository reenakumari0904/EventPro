import express from "express";
import { getRecommendations, getAiRecommendationSummary } from "../controllers/recommendation.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/recommendations", requireAuth, requireAdmin, getRecommendations);
router.post("/recommendations/ai-summary", requireAuth, requireAdmin, getAiRecommendationSummary);

export default router;
