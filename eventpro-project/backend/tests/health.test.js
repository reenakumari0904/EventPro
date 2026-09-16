import { jest } from "@jest/globals";

jest.unstable_mockModule("../config/db.js", () => import("./mockDb.js"));

const { query } = await import("../config/db.js");
const { default: app } = await import("../server.js");
const request = (await import("supertest")).default;

describe("GET /api/health and /api/ready", () => {
  beforeEach(() => query.mockReset());

  it("health is always ok and requires no auth", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptime_seconds).toBe("number");
  });

  it("ready reports ready when the DB responds", async () => {
    // /api/ready calls pool.query directly, not the query() helper — see
    // health.controller.js — so mock the pool export too.
    const { pool } = await import("../config/db.js");
    pool.query.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });
    const res = await request(app).get("/api/ready");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready");
  });

  it("ready reports 503 when the DB is unreachable", async () => {
    const { pool } = await import("../config/db.js");
    pool.query.mockRejectedValueOnce(new Error("connection refused"));
    const res = await request(app).get("/api/ready");
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("not_ready");
  });

  it("returns a JSON 404 for unknown routes instead of an HTML error page", async () => {
    const res = await request(app).get("/api/this-route-does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/No route found/);
  });
});
