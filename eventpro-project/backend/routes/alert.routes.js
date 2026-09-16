import express from "express";
import { getAlerts, acknowledgeAlert, generateOperationalAlerts, generateAiPredictiveAlert } from "../controllers/alert.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/alerts", requireAuth, requireAdmin, getAlerts);
router.put("/alerts/:id/acknowledge", requireAuth, requireAdmin, acknowledgeAlert);
router.post("/alerts/generate", requireAuth, requireAdmin, generateOperationalAlerts);
router.post("/alerts/ai-predict", requireAuth, requireAdmin, generateAiPredictiveAlert);

export default router;
