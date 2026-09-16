import { pool } from "../config/db.js";
import { getCounters, getUptimeSeconds } from "../utils/metrics.js";

// GET /api/metrics — Prometheus text exposition format (v0.0.4). No new
// dependency: the metric set is small and fixed, so this is hand-rolled
// rather than pulling in prom-client. Point a Prometheus `scrape_config`
// at this path — see docs/DEPLOYMENT.md.
//
// Left unauthenticated, like /health and /ready: it exposes only counts
// (request volume, agent/workflow run outcomes, DB pool sizing), never
// business data, which matches how Prometheus itself is normally deployed
// (scraped from inside a private network, not the public internet).
export async function getMetrics(req, res) {
  const lines = [];

  lines.push("# HELP eventpro_uptime_seconds Seconds since the process started.");
  lines.push("# TYPE eventpro_uptime_seconds gauge");
  lines.push(`eventpro_uptime_seconds ${getUptimeSeconds()}`);

  const mem = process.memoryUsage();
  lines.push("# HELP eventpro_process_memory_bytes Node.js process memory usage by type.");
  lines.push("# TYPE eventpro_process_memory_bytes gauge");
  lines.push(`eventpro_process_memory_bytes{type="rss"} ${mem.rss}`);
  lines.push(`eventpro_process_memory_bytes{type="heapUsed"} ${mem.heapUsed}`);
  lines.push(`eventpro_process_memory_bytes{type="heapTotal"} ${mem.heapTotal}`);

  lines.push("# HELP eventpro_db_pool_connections Postgres connection pool state.");
  lines.push("# TYPE eventpro_db_pool_connections gauge");
  lines.push(`eventpro_db_pool_connections{state="total"} ${pool.totalCount}`);
  lines.push(`eventpro_db_pool_connections{state="idle"} ${pool.idleCount}`);
  lines.push(`eventpro_db_pool_connections{state="waiting"} ${pool.waitingCount}`);

  // Every counter recorded via utils/metrics.js — HTTP requests (by
  // method/route/status class), agent orchestration runs, per-agent
  // outcomes, and reactive workflow runs (by workflow/status).
  const grouped = new Map();
  for (const [k, v] of getCounters()) {
    const name = k.includes("{") ? k.slice(0, k.indexOf("{")) : k;
    if (!grouped.has(name)) grouped.set(name, []);
    grouped.get(name).push([k, v]);
  }
  for (const [name, entries] of grouped) {
    lines.push(`# HELP ${name} EventPro application counter.`);
    lines.push(`# TYPE ${name} counter`);
    for (const [k, v] of entries) lines.push(`${k} ${v}`);
  }

  res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(lines.join("\n") + "\n");
}
