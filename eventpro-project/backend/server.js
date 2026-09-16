import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";

import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import eventRoutes from "./routes/event.routes.js";
import registrationRoutes from "./routes/registration.routes.js";
import checkinRoutes from "./routes/checkin.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import venueRoutes from "./routes/venue.routes.js";
import speakerRoutes from "./routes/speaker.routes.js";
import sessionRoutes from "./routes/session.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import sponsorRoutes from "./routes/sponsor.routes.js";
import incidentRoutes from "./routes/incident.routes.js";
import alertRoutes from "./routes/alert.routes.js";
import recommendationRoutes from "./routes/recommendation.routes.js";
import intelligenceRoutes from "./routes/intelligence.routes.js";
import orchestrationRoutes from "./routes/orchestration.routes.js";
import workflowRoutes from "./routes/workflow.routes.js";
import healthRoutes from "./routes/health.routes.js";
import "./services/workflows/index.js"; // registers reactive workflows (e.g. speaker-cancellation) with the engine

import { apiLimiter, authLimiter } from "./middleware/security.middleware.js";
import { metricsMiddleware } from "./middleware/metrics.middleware.js";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware.js";
import { pool } from "./config/db.js";

dotenv.config();

const app = express();
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.set("trust proxy", 1);

const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());
app.use(cors({ origin: corsOrigins, credentials: true }));

app.use(compression()); 
app.use(express.json({ limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(metricsMiddleware);

app.use("/api", apiLimiter);
app.use("/api/login", authLimiter);
app.use("/api/register", authLimiter);

// ----- Routes -----
app.use("/api", healthRoutes);
app.use("/api", authRoutes);
app.use("/api", adminRoutes);
app.use("/api", eventRoutes);
app.use("/api", registrationRoutes);
app.use("/api", checkinRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", venueRoutes);
app.use("/api", speakerRoutes);
app.use("/api", sessionRoutes);
app.use("/api", aiRoutes);
app.use("/api", sponsorRoutes);
app.use("/api", incidentRoutes);
app.use("/api", alertRoutes);
app.use("/api", recommendationRoutes);
app.use("/api", intelligenceRoutes);
app.use("/api", orchestrationRoutes);
app.use("/api", workflowRoutes);

app.get("/", (req, res) => res.send("EventPro API is running"));
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
export default app;
if (process.env.NODE_ENV !== "test") {
  const server = app.listen(PORT, () => console.log(`EventPro API listening on port ${PORT}`));
  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down gracefully...`);
    server.close(async () => {
      try {
        await pool.end();
      } finally {
        process.exit(0);
      }
    });

    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

