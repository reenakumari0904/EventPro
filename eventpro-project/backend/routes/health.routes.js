import express from "express";
import { getHealth, getReadiness } from "../controllers/health.controller.js";
import { getMetrics } from "../controllers/metrics.controller.js";

const router = express.Router();

router.get("/health", getHealth);
router.get("/ready", getReadiness);
router.get("/metrics", getMetrics);

export default router;
