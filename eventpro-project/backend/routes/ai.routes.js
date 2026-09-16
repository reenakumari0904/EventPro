import express from "express";
import { generateAiInsights } from "../controllers/ai.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/ai/insights", requireAuth, requireAdmin, generateAiInsights);

export default router;