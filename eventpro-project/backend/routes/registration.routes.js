import express from "express";
import {
  registerForEvent,
  getAttendees,
  updateRegistrationStatus,
} from "../controllers/registration.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/event/register", registerForEvent);

router.get("/attendees", requireAuth, requireAdmin, getAttendees);
router.put("/registration/status", requireAuth, requireAdmin, updateRegistrationStatus);

export default router;