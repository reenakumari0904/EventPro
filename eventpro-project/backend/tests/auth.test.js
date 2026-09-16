import { jest } from "@jest/globals";
import bcrypt from "bcryptjs";

jest.unstable_mockModule("../config/db.js", () => import("./mockDb.js"));

const { query } = await import("../config/db.js");
const { default: app } = await import("../server.js");
const request = (await import("supertest")).default;

describe("POST /api/login", () => {
  beforeEach(() => query.mockReset());

  it("rejects an unknown email with 401 and no user-enumeration detail", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post("/api/login").send({ email: "nobody@example.com", password: "whatever" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("rejects a wrong password with 401", async () => {
    const password_hash = await bcrypt.hash("correct-horse-battery-staple", 10);
    query.mockResolvedValueOnce({ rows: [{ user_id: 1, role: "admin", password_hash, name: "Ada" }] });
    const res = await request(app).post("/api/login").send({ email: "ada@example.com", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("returns a signed JWT on correct credentials", async () => {
    const password_hash = await bcrypt.hash("correct-horse-battery-staple", 10);
    query.mockResolvedValueOnce({ rows: [{ user_id: 1, role: "admin", password_hash, name: "Ada" }] });
    const res = await request(app).post("/api/login").send({ email: "ada@example.com", password: "correct-horse-battery-staple" });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user).toMatchObject({ name: "Ada", role: "admin" });
  });

  it("is rate-limited after repeated attempts", async () => {
    query.mockResolvedValue({ rows: [] });
    let lastStatus;
    for (let i = 0; i < 25; i++) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).post("/api/login").send({ email: "x@example.com", password: "x" });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});

describe("Auth-protected routes reject missing/invalid tokens", () => {
  it("GET /api/orchestration/run without a token returns 401", async () => {
    const res = await request(app).get("/api/orchestration/run");
    expect(res.status).toBe(401);
  });

  it("GET /api/orchestration/run with a garbage token returns 401", async () => {
    const res = await request(app).get("/api/orchestration/run").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });
});
