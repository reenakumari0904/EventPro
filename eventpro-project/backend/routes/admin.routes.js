import express from "express";
import { adminSignup, adminLogin } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/admin/register", adminSignup);
router.post("/admin/login", adminLogin);

export default router;