// ============================================================
// Agent Registry
// ============================================================
// Milestone 3 — Agent Orchestration.
//
// Every "AI agent" already built into EventPro (registration intelligence,
// venue/speaker ops, sponsor/incident ops, alerting, recommendations) does
// real work by itself, but nothing coordinated them as a single system.
// This file is the single place that lists what an "agent" is in this
// platform, so the Orchestrator (./orchestrator.js) can run, time, and
// report on all of them the same way instead of each route reinventing it.
//
// An agent here is intentionally simple: { name, description, run(ctx) }.
// `run` returns plain JSON-serializable data (or throws) — no req/res,
// so agents can be invoked from HTTP routes, the orchestrator, a cron
// job, or a test, identically.

import { computeOverview, computeInsights } from "../controllers/intelligence.controller.js";
import { computeRecommendations } from "../controllers/recommendation.controller.js";
import { runAlertGeneration } from "../controllers/alert.controller.js";
import { query } from "../config/db.js";

// ----- Event Intelligence Engine agents -----

const overviewAgent = {
  name: "event-overview",
  description: "Aggregates registration, scheduling, session, sponsorship, incident, and alert data into the Event Health Score.",
  run: () => computeOverview(),
};

const insightsAgent = {
  name: "pattern-insights",
  description: "Detects capacity trends, registration velocity, scheduling gaps, and sponsor risk from live data.",
  run: () => computeInsights(),
};

// ----- Sponsor & Incident Ops agent -----

const recommendationAgent = {
  name: "sponsor-incident-recommendations",
  description: "Flags unengaged sponsors, overdue deliverables, and stale/unacknowledged incidents.",
  run: () => computeRecommendations(),
};

// ----- Operational Alerting agent -----

const alertGenerationAgent = {
  name: "operational-alerting",
  description: "Rule-based agent that writes new operational_alerts rows for deliverables, capacity, and schedule risk.",
  run: (ctx) => (ctx?.generateAlerts ? runAlertGeneration() : Promise.resolve({ created: [], count: 0, skipped: true })),
};

// ----- Registration / Check-in pulse agent -----
// A lightweight fifth data source so orchestration isn't only reading from
// the same three tables the other agents already cover.

const registrationPulseAgent = {
  name: "registration-pulse",
  description: "Live registration velocity and check-in throughput over the last hour.",
  run: async () => {
    const result = await query(
      `SELECT
         COUNT(*) FILTER (WHERE registration_date > NOW() - INTERVAL '1 hour') AS registrations_last_hour,
         COUNT(*) FILTER (WHERE registration_date > NOW() - INTERVAL '10 minutes') AS registrations_last_10min
       FROM registrations`
    );
    const checkinResult = await query(
      `SELECT COUNT(*) AS checkins_last_hour FROM checkins WHERE checkin_time > NOW() - INTERVAL '1 hour'`
    );
    return {
      registrations_last_hour: parseInt(result.rows[0].registrations_last_hour, 10),
      registrations_last_10min: parseInt(result.rows[0].registrations_last_10min, 10),
      checkins_last_hour: parseInt(checkinResult.rows[0].checkins_last_hour, 10),
    };
  },
};

// The registry the Orchestrator iterates over. Order matters only in that
// insightsAgent and alertGenerationAgent read the freshest overview-adjacent
// data — but each agent still queries independently, so a failure in one
// never blocks another (see orchestrator.js's Promise.allSettled usage).
export const AGENT_REGISTRY = [
  overviewAgent,
  insightsAgent,
  recommendationAgent,
  registrationPulseAgent,
  alertGenerationAgent,
];

export default AGENT_REGISTRY;
