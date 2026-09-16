import express from "express";
import {
  createVenue, getVenues, updateVenue, deleteVenue,
  suggestVenue, aiSuggestVenue, getVenueOptimizationAnalytics,
} from "../controllers/venue.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/venues", requireAuth, requireAdmin, createVenue);
router.get("/venues", requireAuth, requireAdmin, getVenues);
router.put("/venues/:id", requireAuth, requireAdmin, updateVenue);
router.delete("/venues/:id", requireAuth, requireAdmin, deleteVenue);
router.get("/venues/suggest", requireAuth, requireAdmin, suggestVenue);
router.post("/venues/ai-suggest", requireAuth, requireAdmin, aiSuggestVenue);
router.get("/venues/optimization-analytics", requireAuth, requireAdmin, getVenueOptimizationAnalytics);

export default router;
