import { jest } from "@jest/globals";

jest.unstable_mockModule("../config/db.js", () => import("./mockDb.js"));

const { query } = await import("../config/db.js");
const { runOrchestration } = await import("../services/orchestrator.js");
const { clearCache } = await import("../utils/cache.js");

// Every agent in services/agents.js ultimately calls query(). Rather than
// hand-crafting the exact sequence for all five agents (overview, insights,
// recommendations, registration-pulse, alerting), default every call to an
// empty-but-valid shape and let each test override what it cares about.
function stubAllQueriesEmpty() {
  query.mockImplementation(() =>
    Promise.resolve({ rows: [{ total: "0", count: "0", avg: null, avg_rate: null, total_contracted: "0", total_paid: "0", recent: "0", registrations_last_hour: "0", registrations_last_10min: "0", checkins_last_hour: "0" }] })
  );
}

describe("runOrchestration", () => {
  beforeEach(() => {
    query.mockReset();
    clearCache();
  });

  it("runs every registered agent and reports them all healthy on the happy path", async () => {
    stubAllQueriesEmpty();
    const report = await runOrchestration({ generateAlerts: false, useCache: false });
    expect(report.total_agents).toBe(5);
    expect(report.healthy_agents).toBe(5);
    expect(report.agents.every((a) => a.status === "ok")).toBe(true);
    expect(Array.isArray(report.priority_actions)).toBe(true);
  });

  it("isolates a single failing agent instead of failing the whole run", async () => {
    let call = 0;
    query.mockImplementation(() => {
      call += 1;
      // The very first query() call belongs to the overview agent
      // (regTotals) — make just that one blow up.
      if (call === 1) return Promise.reject(new Error("DB connection lost"));
      return Promise.resolve({ rows: [{ total: "0", count: "0", avg: null, avg_rate: null, total_contracted: "0", total_paid: "0", recent: "0", registrations_last_hour: "0", registrations_last_10min: "0", checkins_last_hour: "0" }] });
    });

    const report = await runOrchestration({ generateAlerts: false, useCache: false });
    const overviewAgent = report.agents.find((a) => a.name === "event-overview");
    expect(overviewAgent.status).toBe("error");
    expect(overviewAgent.error).toMatch(/DB connection lost/);
    // The other four agents still ran and succeeded.
    expect(report.healthy_agents).toBe(4);
    expect(report.overview).toBeNull();
  });

  it("serves a cached report on the second call within the TTL window", async () => {
    stubAllQueriesEmpty();
    const first = await runOrchestration({ generateAlerts: false, useCache: true });
    const callsAfterFirst = query.mock.calls.length;
    const second = await runOrchestration({ generateAlerts: false, useCache: true });
    expect(second.cached).toBe(true);
    expect(second.run_at).toBe(first.run_at);
    // No new queries were issued for the cached call.
    expect(query.mock.calls.length).toBe(callsAfterFirst);
  });

  it("never caches a run that generates alerts, since that has side effects", async () => {
    stubAllQueriesEmpty();
    await runOrchestration({ generateAlerts: true, useCache: true });
    const callsAfterFirst = query.mock.calls.length;
    await runOrchestration({ generateAlerts: true, useCache: true });
    expect(query.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });

  it("merges insights, recommendations, and generated alerts into one ranked priority list", async () => {
    // Force the pattern-insights agent to surface a "high" severity item by
    // giving the near-term-unscheduled-session query a matching row, while
    // every other query stays empty.
    let call = 0;
    query.mockImplementation((sql) => {
      call += 1;
      if (typeof sql === "string" && sql.includes("speaker_id IS NULL")) {
        return Promise.resolve({
          rows: [{ session_id: 1, title: "Unassigned Talk", start_time: new Date(Date.now() + 30 * 60000).toISOString() }],
        });
      }
      return Promise.resolve({ rows: [{ total: "0", count: "0", avg: null, avg_rate: null, total_contracted: "0", total_paid: "0", recent: "0", registrations_last_hour: "0", registrations_last_10min: "0", checkins_last_hour: "0" }] });
    });

    const report = await runOrchestration({ generateAlerts: false, useCache: false });
    expect(report.priority_actions.length).toBeGreaterThan(0);
    expect(report.priority_actions[0].severity).toBe("high");
    expect(report.priority_actions[0].source).toBe("insight");
  });
});
