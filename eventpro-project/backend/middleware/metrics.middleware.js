import { incrementCounter } from "../utils/metrics.js";

// Records one counter increment per finished request, labeled by method,
// a low-cardinality route template (not the raw URL — avoids a label
// explosion from path params like /sessions/482), and status class
// (2xx/4xx/5xx). Attached in server.js before the routes.
export function metricsMiddleware(req, res, next) {
  res.on("finish", () => {
    const routeTemplate = req.route?.path
      ? `${req.baseUrl || ""}${req.route.path}`
      : req.path.replace(/\/\d+(?=\/|$)/g, "/:id"); // best-effort template when no matched route (404s)
    incrementCounter("http_requests_total", {
      method: req.method,
      route: routeTemplate,
      status: `${Math.floor(res.statusCode / 100)}xx`,
    });
  });
  next();
}
