// ============================================================
// Minimal in-memory metrics registry
// ============================================================
// Milestone 3 — Platform Reliability & Security / Monitoring.
//
// A small, dependency-free counter/gauge registry exposed in Prometheus
// text exposition format at GET /api/metrics (see
// controllers/metrics.controller.js). Same single-process tradeoff as
// utils/cache.js — for a multi-replica deployment, each instance reports
// its own counters, which is exactly how Prometheus expects to scrape
// replicas individually (it aggregates across instances at query time via
// `sum()`), so this isn't a limitation for that use case.
//
// Intentionally not a full client library (no prom-client dependency):
// the metric set here is small and fixed, so hand-rolling the exposition
// format keeps this at zero new dependencies.

const counters = new Map(); // "name{labels}" -> count
const startedAt = Date.now();

function key(name, labels) {
  if (!labels || Object.keys(labels).length === 0) return name;
  const labelStr = Object.entries(labels)
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`)
    .join(",");
  return `${name}{${labelStr}}`;
}

export function incrementCounter(name, labels = {}, amount = 1) {
  const k = key(name, labels);
  counters.set(k, (counters.get(k) || 0) + amount);
}

export function getCounters() {
  return new Map(counters);
}

export function resetMetrics() {
  counters.clear();
}

export function getUptimeSeconds() {
  return Math.round((Date.now() - startedAt) / 1000);
}
