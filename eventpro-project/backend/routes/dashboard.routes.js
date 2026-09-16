import express from "express";
import { getDashboardStats, getAnalytics } from "../controllers/dashboard.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/dashboard", requireAuth, requireAdmin, getDashboardStats);
router.get("/analytics", requireAuth, requireAdmin, getAnalytics);

export default router;