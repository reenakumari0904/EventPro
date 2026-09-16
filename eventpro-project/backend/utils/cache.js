// ============================================================
// Minimal in-memory TTL cache
// ============================================================
// Milestone 3 — Performance Optimization.
//
// The orchestrator and intelligence endpoints run 5+ SQL queries each.
// Executive dashboards, SSE streams, and polling clients can easily call
// them several times a second. A tiny in-process cache with a short TTL
// (a few seconds) keeps the database load flat under that traffic without
// introducing a Redis dependency for a single-instance deployment.
//
// Not a distributed cache — if you scale the API horizontally behind a
// load balancer, swap this for Redis (the get/set/del interface below is
// intentionally the same shape).

const store = new Map();

export function getCache(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function setCache(key, value, ttlMs = 5000) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function delCache(key) {
  store.delete(key);
}

export function clearCache() {
  store.clear();
}
