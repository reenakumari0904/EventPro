import express from "express";
import {
  createSponsor, getSponsors, updateSponsor, deleteSponsor,
  createDeliverable, getDeliverables, updateDeliverableStatus, updateDeliverableApproval,
  recordEngagement, getSponsorAnalytics, aiSponsorInsights,
  recordPayment, getPayments,
  createPackage, getPackages, assignPackageToSponsor,
} from "../controllers/sponsor.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/sponsors", requireAuth, requireAdmin, createSponsor);
router.get("/sponsors", requireAuth, requireAdmin, getSponsors);
router.put("/sponsors/:id", requireAuth, requireAdmin, updateSponsor);
router.delete("/sponsors/:id", requireAuth, requireAdmin, deleteSponsor);

router.post("/sponsors/:id/deliverables", requireAuth, requireAdmin, createDeliverable);
router.get("/sponsors/deliverables", requireAuth, requireAdmin, getDeliverables);
router.put("/sponsors/deliverables/:deliverableId", requireAuth, requireAdmin, updateDeliverableStatus);
router.put("/sponsors/deliverables/:deliverableId/approval", requireAuth, requireAdmin, updateDeliverableApproval);

router.post("/sponsors/:id/engagement", requireAuth, requireAdmin, recordEngagement);
router.get("/sponsors/analytics", requireAuth, requireAdmin, getSponsorAnalytics);
router.post("/sponsors/ai-insights", requireAuth, requireAdmin, aiSponsorInsights);

router.post("/sponsors/:id/payments", requireAuth, requireAdmin, recordPayment);
router.get("/sponsors/payments", requireAuth, requireAdmin, getPayments);

router.post("/sponsorship-packages", requireAuth, requireAdmin, createPackage);
router.get("/sponsorship-packages", requireAuth, requireAdmin, getPackages);
router.post("/sponsors/:id/assign-package", requireAuth, requireAdmin, assignPackageToSponsor);

export default router;
