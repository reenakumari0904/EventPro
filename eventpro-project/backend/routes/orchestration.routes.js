import express from "express";
import { listAgents, runOnce, streamOrchestration } from "../controllers/orchestration.controller.js";
import { requireAuth, requireAdmin, requireAuthFlexible } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/orchestration/agents", requireAuth, requireAdmin, listAgents);
router.get("/orchestration/run", requireAuth, requireAdmin, runOnce);
// SSE: token may arrive via query string, so this uses the flexible auth check.
router.get("/orchestration/stream", requireAuthFlexible, requireAdmin, streamOrchestration);

export default router;
