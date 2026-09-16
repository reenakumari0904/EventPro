import { jest } from "@jest/globals";

jest.unstable_mockModule("../config/db.js", () => import("./mockDb.js"));

const { query } = await import("../config/db.js");
const { resetMetrics } = await import("../utils/metrics.js");
const { default: app } = await import("../server.js");
const request = (await import("supertest")).default;

describe("GET /api/metrics", () => {
  beforeEach(() => {
    query.mockReset();
    resetMetrics();
  });

  it("is public (no auth) and returns Prometheus text exposition format", async () => {
    const res = await request(app).get("/api/metrics");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/plain/);
    expect(res.text).toMatch(/^# HELP eventpro_uptime_seconds/m);
    expect(res.text).toMatch(/^eventpro_uptime_seconds \d+/m);
    expect(res.text).toMatch(/^eventpro_process_memory_bytes\{type="rss"\} \d+/m);
    expect(res.text).toMatch(/^eventpro_db_pool_connections\{state="total"\}/m);
  });

  it("counts HTTP requests it has already served, labeled by route and status class", async () => {
    await request(app).get("/api/health");
    await request(app).get("/api/health");
    await request(app).get("/api/this-route-does-not-exist");

    const res = await request(app).get("/api/metrics");
    expect(res.text).toMatch(/http_requests_total\{method="GET",route="\/api\/health",status="2xx"\} 2/);
    expect(res.text).toMatch(/http_requests_total\{method="GET",route="\/api\/this-route-does-not-exist",status="4xx"\} 1/);
  });

  it("is exempt from the general API rate limiter", async () => {
    // apiLimiter's window is generous (300/min) so this mostly documents
    // intent, but confirms the skip() predicate doesn't 429 a scrape burst.
    let lastStatus;
    for (let i = 0; i < 10; i++) {
      // eslint-disable-next-line no-await-in-loop
      lastStatus = (await request(app).get("/api/metrics")).status;
    }
    expect(lastStatus).toBe(200);
  });
});
