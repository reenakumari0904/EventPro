import { AGENT_REGISTRY } from "./agents.js";
import { getCache, setCache } from "../utils/cache.js";
import { incrementCounter } from "../utils/metrics.js";

const CACHE_KEY = "orchestrator:last_run";
const CACHE_TTL_MS = 4000; 

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 };

function rankOf(level) {
  return SEVERITY_RANK[level] ?? 5;
}
function buildPriorityActions({ insights, recommendations, alertsGenerated }) {
  const actions = [];

  for (const i of insights || []) {
    actions.push({
      source: "insight",
      severity: i.severity === "informational" ? "informational" : i.severity,
      title: i.title,
      message: i.message,
    });
  }

  for (const r of recommendations || []) {
    actions.push({
      source: "recommendation",
      severity: r.priority, // high | medium | low
      title: r.title,
      message: r.message,
    });
  }

  for (const a of alertsGenerated?.created || []) {
    actions.push({
      source: "alert",
      severity: a.alert_level,
      title: a.title,
      message: a.message,
    });
  }

  actions.sort((a, b) => rankOf(a.severity) - rankOf(b.severity));
  return actions;
}

/**
 * Run every agent in the registry once.
 * @param {{ generateAlerts?: boolean, useCache?: boolean }} options
 */
export async function runOrchestration(options = {}) {
  const { generateAlerts = false, useCache = true } = options;
  if (useCache && !generateAlerts) {
    const cached = getCache(CACHE_KEY);
    if (cached) return { ...cached, cached: true };
  }

  const startedAt = Date.now();
  const settled = await Promise.allSettled(
    AGENT_REGISTRY.map(async (agent) => {
      const agentStart = Date.now();
      const data = await agent.run({ generateAlerts });
      return { name: agent.name, description: agent.description, data, duration_ms: Date.now() - agentStart };
    })
  );

  const agentResults = {};
  const agentStatus = [];
  settled.forEach((result, idx) => {
    const agent = AGENT_REGISTRY[idx];
    if (result.status === "fulfilled") {
      agentResults[agent.name] = result.value.data;
      agentStatus.push({
        name: agent.name,
        status: "ok",
        duration_ms: result.value.duration_ms,
      });
    } else {
      agentStatus.push({
        name: agent.name,
        status: "error",
        error: result.reason?.message || String(result.reason),
      });
    }
  });

  const priorityActions = buildPriorityActions({
    insights: agentResults["pattern-insights"],
    recommendations: agentResults["sponsor-incident-recommendations"],
    alertsGenerated: agentResults["operational-alerting"],
  });

  const report = {
    run_at: new Date().toISOString(),
    duration_ms: Date.now() - startedAt,
    agents: agentStatus,
    healthy_agents: agentStatus.filter((a) => a.status === "ok").length,
    total_agents: agentStatus.length,
    overview: agentResults["event-overview"] || null,
    insights: agentResults["pattern-insights"] || [],
    recommendations: agentResults["sponsor-incident-recommendations"] || [],
    registration_pulse: agentResults["registration-pulse"] || null,
    alerts_generated: agentResults["operational-alerting"] || { created: [], count: 0 },
    priority_actions: priorityActions,
    cached: false,
  };

  if (useCache) setCache(CACHE_KEY, report, CACHE_TTL_MS);
  incrementCounter("orchestration_runs_total", { generate_alerts: String(generateAlerts) });
  for (const a of agentStatus) incrementCounter("agent_run_total", { agent: a.name, status: a.status });
  return report;
}
