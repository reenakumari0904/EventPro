// ============================================================
// Centralized error handling
// ============================================================
// Milestone 3 — Platform Reliability & Security.
//
// Before this, every controller had its own try/catch that logged and
// shaped its own error JSON (fine, and left in place — see
// docs/API.md for the per-endpoint error shape). This adds the two things
// that were still missing project-wide:
//   1. A 404 handler for unknown routes/API typos, instead of Express's
//      default HTML error page.
//   2. A final safety-net error handler that catches anything a controller
//      didn't (e.g. a thrown error before a try/catch, or a bug), so the
//      API never leaks a stack trace to the client and never crashes the
//      process on an unhandled synchronous error in a route.

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `No route found for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);
  const status = err.status || 500;
  const message = process.env.NODE_ENV === "production" && status === 500
    ? "Something went wrong on our end. Please try again."
    : err.message || "Internal server error.";
  res.status(status).json({ error: message });
}
