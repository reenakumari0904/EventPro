import express from "express";
import {
  createIncident, getIncidents, updateIncidentStatus, escalateIncident,
  aiTriageIncident, getIncidentAnalytics,
} from "../controllers/incident.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/incidents", requireAuth, requireAdmin, createIncident);
router.get("/incidents", requireAuth, requireAdmin, getIncidents);
router.get("/incidents/analytics", requireAuth, requireAdmin, getIncidentAnalytics);
router.post("/incidents/ai-triage", requireAuth, requireAdmin, aiTriageIncident);
router.put("/incidents/:id/status", requireAuth, requireAdmin, updateIncidentStatus);
router.post("/incidents/:id/escalate", requireAuth, requireAdmin, escalateIncident);

export default router;
