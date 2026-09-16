// ============================================================
// Workflow: Sponsor Performance
// ============================================================
// Milestone brief, "Scenario 2 – Sponsor Performance":
//   Sponsor data → Engagement tracking → Lead calculation → Conversion
//   rate → ROI indicator → Dashboard.
//
// Trigger: POST /api/workflows/sponsor-performance  { sponsor_id }

import { query } from "../../config/db.js";
import { createIncidentRecord } from "../../controllers/incident.controller.js";
import { clearCache } from "../../utils/cache.js";
import { defineWorkflow } from "./engine.js";

const steps = [
  // ---- 1. Sponsor Agent: load sponsor data ----
  {
    name: "sponsor-agent-load-sponsor",
    agent: "sponsor-agent",
    onError: "abort",
    run: async (ctx) => {
      const result = await query(`SELECT * FROM sponsors WHERE sponsor_id = $1`, [ctx.sponsor_id]);
      const sponsor = result.rows[0];
      if (!sponsor) throw new Error(`Sponsor ${ctx.sponsor_id} not found.`);
      return { sponsor };
    },
  },

  // ---- 2. Sponsor Agent: engagement tracking ----
  {
    name: "sponsor-agent-track-engagement",
    agent: "sponsor-agent",
    onError: "continue",
    run: async (ctx) => {
      const result = await query(
        `SELECT metric_type, COALESCE(SUM(metric_value), 0) AS total
         FROM sponsor_engagement WHERE sponsor_id = $1 GROUP BY metric_type`,
        [ctx.sponsor_id]
      );
      const byType = Object.fromEntries(result.rows.map((r) => [r.metric_type, parseFloat(r.total)]));
      return { engagementByType: byType };
    },
  },

  // ---- 3. Event Intelligence Engine: lead calculation ----
  {
    name: "intelligence-engine-lead-calculation",
    agent: "event-intelligence-engine",
    onError: "continue",
    run: async (ctx) => ({ leadsGenerated: ctx.engagementByType?.lead || 0 }),
  },

  // ---- 4. Event Intelligence Engine: conversion rate ----
  {
    name: "intelligence-engine-conversion-rate",
    agent: "event-intelligence-engine",
    onError: "continue",
    run: async (ctx) => {
      const conversions = ctx.engagementByType?.conversion || 0;
      const conversionRatePct = ctx.leadsGenerated > 0 ? Math.round((conversions / ctx.leadsGenerated) * 100) : null;
      return { conversions, conversionRatePct };
    },
  },

  // ---- 5. Event Intelligence Engine: ROI indicator ----
  // Same documented proxy as the Executive Dashboard's Sponsor ROI card
  // (see controllers/intelligence.controller.js) — conversion rate as a
  // stand-in for financial ROI, which the platform has no data to compute.
  {
    name: "intelligence-engine-roi-indicator",
    agent: "event-intelligence-engine",
    onError: "continue",
    run: async (ctx) => {
      const roiPct = ctx.conversionRatePct;
      const roiLevel = roiPct === null ? "insufficient_data" : roiPct >= 50 ? "good" : roiPct >= 25 ? "average" : "poor";
      return { roiPct, roiLevel };
    },
  },

  // ---- 6. Operational Alert: flag an underperforming high-value sponsor ----
  // Not in the brief's one-line summary, but a natural "recommend an
  // action" step consistent with every other workflow here — a Platinum/
  // Gold sponsor with a "poor" ROI indicator is exactly the kind of thing
  // an account manager needs to know about before renewal conversations.
  {
    name: "incident-agent-flag-underperforming-sponsor",
    agent: "incident-agent",
    onError: "continue",
    run: async (ctx) => {
      const highValueTier = ["Platinum", "Gold"].includes(ctx.sponsor.tier);
      if (ctx.roiLevel !== "poor" || !highValueTier) return { flagged: false };
      const incident = await createIncidentRecord({
        title: `Low engagement ROI for ${ctx.sponsor.tier} sponsor: ${ctx.sponsor.name}`,
        description: `${ctx.sponsor.name} (${ctx.sponsor.tier}) is converting only ${ctx.roiPct ?? 0}% of ${ctx.leadsGenerated} logged leads. Consider a check-in before renewal conversations.`,
        incident_type: "vip_issue",
        reported_by: ctx.triggeredBy || "agent-orchestrator",
      });
      return { flagged: true, incident };
    },
  },

  // ---- 7. Executive Dashboard: reflect the updated figures ----
  {
    name: "executive-dashboard-update",
    agent: "executive-dashboard",
    onError: "continue",
    run: async () => {
      clearCache();
      return { dashboardRefreshed: true };
    },
  },
];

defineWorkflow("sponsor-performance", steps);

export default steps;
