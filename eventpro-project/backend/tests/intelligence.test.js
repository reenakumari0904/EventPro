import { jest } from "@jest/globals";

jest.unstable_mockModule("../config/db.js", () => import("./mockDb.js"));

const { query } = await import("../config/db.js");
const { computeOverview, computeInsights } = await import("../controllers/intelligence.controller.js");

// computeOverview() issues a fixed, known set of queries (see
// controllers/intelligence.controller.js). We route the mock by
// recognizable SQL fragments rather than call order, so adding a new
// query to the function doesn't silently misalign every existing mock.
function mockOverviewQueries({
  total = 100,
  checkedIn = 60,
  sessionTotal = 10,
  withSpeaker = 9,
  avgRating = 4.2,
  avgAttendance = 75,
  contracted = 50000,
  paid = 30000,
  sponsorAtRisk = 0,
  sponsorCount = 5,
  sponsorLeads = 0,
  sponsorConversions = 0,
  totalVenues = 3,
  venuesInUse = 2,
  avgOccupancy = 65,
  totalSpeakers = 4,
  speakersParticipating = 3,
  completedSessions = 5,
  avgSpeakerRating = 4.0,
  openIncidents = [],
  unackAlerts = [],
} = {}) {
  query.mockImplementation(async (sql) => {
    const s = typeof sql === "string" ? sql : "";
    if (s.includes("FROM registrations")) return { rows: [{ total: String(total) }] };
    if (s.includes("FROM checkins WHERE checkin_time")) return { rows: [{ count: String(checkedIn) }] };
    if (s.includes("COUNT(*) FILTER (WHERE speaker_id IS NOT NULL)")) return { rows: [{ total: String(sessionTotal), with_speaker: String(withSpeaker) }] };
    if (s.includes("AVG(session_rating)")) return { rows: [{ avg: avgRating }] };
    if (s.includes("avg_rate")) return { rows: [{ avg_rate: avgAttendance }] };
    if (s.includes("SUM(contract_amount)")) return { rows: [{ total_contracted: String(contracted) }] };
    if (s.includes("SUM(amount)")) return { rows: [{ total_paid: String(paid) }] };
    if (s.includes("COUNT(DISTINCT sponsor_id)")) return { rows: [{ count: String(sponsorAtRisk) }] };
    if (s.includes("COUNT(*) AS count FROM sponsors")) return { rows: [{ count: String(sponsorCount) }] };
    if (s.includes("FROM sponsor_engagement")) return { rows: [{ leads: String(sponsorLeads), conversions: String(sponsorConversions) }] };
    if (s.includes("FROM venues") && s.includes("venues_in_use")) return { rows: [{ total_venues: String(totalVenues), venues_in_use: String(venuesInUse) }] };
    if (s.includes("avg_occupancy_pct")) return { rows: [{ avg_occupancy_pct: avgOccupancy }] };
    if (s.includes("speakers_participating")) return { rows: [{ total_speakers: String(totalSpeakers), speakers_participating: String(speakersParticipating) }] };
    if (s.includes("FROM sessions WHERE end_time <= NOW()")) return { rows: [{ count: String(completedSessions) }] };
    if (s.includes("AVG(speaker_rating)")) return { rows: [{ avg: avgSpeakerRating }] };
    if (s.includes("FROM incidents WHERE status NOT IN")) return { rows: openIncidents };
    if (s.includes("FROM operational_alerts WHERE acknowledged")) return { rows: unackAlerts };
    throw new Error(`Unmocked overview query: ${s.slice(0, 80)}`);
  });
}

describe("computeOverview — Event Health Score", () => {
  beforeEach(() => query.mockReset());

  it("scores 100 when every signal is healthy", async () => {
    mockOverviewQueries({});
    const overview = await computeOverview();
    expect(overview.event_health_score).toBe(100);
    expect(overview.score_deductions).toEqual([]);
    expect(overview.registration.checkin_rate_pct).toBe(60);
  });

  it("deducts points for a low check-in rate", async () => {
    mockOverviewQueries({ total: 100, checkedIn: 20 }); // 20% < 50%
    const overview = await computeOverview();
    expect(overview.event_health_score).toBe(90);
    expect(overview.score_deductions).toContain("Check-in rate below 50%");
  });

  it("heavily penalizes critical open incidents and floors the score at 0", async () => {
    mockOverviewQueries({
      openIncidents: [
        { severity: "critical", count: "3" },
        { severity: "high", count: "2" },
      ],
      sponsorAtRisk: 2,
      unackAlerts: [{ alert_level: "critical", count: "1" }],
    });
    const overview = await computeOverview();
    // 100 - 40 (critical, capped x2) - 16 (high, capped x2->x3 min(2,3)=2*8=16) - 10 (sponsor at risk) - 15 (critical alert)
    expect(overview.event_health_score).toBe(19);
    expect(overview.event_health_score).toBeGreaterThanOrEqual(0);
    expect(overview.incidents.critical_open).toBe(3);
  });

  it("never goes below 0 even with every deduction stacked", async () => {
    mockOverviewQueries({
      total: 100,
      checkedIn: 0,
      sessionTotal: 10,
      withSpeaker: 0,
      openIncidents: [
        { severity: "critical", count: "5" },
        { severity: "high", count: "5" },
      ],
      sponsorAtRisk: 4,
      unackAlerts: [{ alert_level: "critical", count: "5" }],
    });
    const overview = await computeOverview();
    expect(overview.event_health_score).toBe(0);
  });

  it("computes venue utilization, speaker participation, and sponsor ROI as documented ratios", async () => {
    mockOverviewQueries({
      totalVenues: 4,
      venuesInUse: 3,
      avgOccupancy: 72,
      totalSpeakers: 10,
      speakersParticipating: 7,
      completedSessions: 6,
      avgSpeakerRating: 4.5,
      sponsorLeads: 50,
      sponsorConversions: 19,
    });
    const overview = await computeOverview();

    expect(overview.venue_performance).toEqual({
      total_venues: 4,
      venues_in_use: 3,
      utilization_pct: 75, // 3/4
      avg_hall_occupancy_pct: 72,
    });
    expect(overview.speaker_performance).toMatchObject({
      sessions_conducted: 6,
      total_speakers: 10,
      speakers_participating: 7,
      participation_pct: 70, // 7/10
      avg_audience_engagement_rating: 4.5,
    });
    // 19/50 = 38% — deliberately the same figure as the brief's example dashboard.
    expect(overview.sponsorship.roi_pct).toBe(38);
  });

  it("returns null ratios instead of dividing by zero when there's no data yet", async () => {
    mockOverviewQueries({ totalVenues: 0, venuesInUse: 0, totalSpeakers: 0, speakersParticipating: 0, sponsorLeads: 0, sponsorConversions: 0 });
    const overview = await computeOverview();
    expect(overview.venue_performance.utilization_pct).toBeNull();
    expect(overview.speaker_performance.participation_pct).toBeNull();
    expect(overview.sponsorship.roi_pct).toBeNull();
  });
});

describe("computeInsights", () => {
  beforeEach(() => query.mockReset());

  it("flags a venue trending toward capacity with actionable timing", async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            venue_id: 1,
            venue_name: "Hall A",
            capacity: 100,
            current_attendance: "85",
            recent_checkins: "12",
            session_id: 7,
            current_session: "Keynote",
          },
        ],
      }) // capacityTrend
      .mockResolvedValueOnce({ rows: [{ title: "Panel", start_time: new Date(Date.now() + 10 * 60000).toISOString() }] }) // nextSession
      .mockResolvedValueOnce({ rows: [{ recent: "0" }] }) // registrationTrend
      .mockResolvedValueOnce({ rows: [] }) // nearTermUnscheduled
      .mockResolvedValueOnce({ rows: [] }); // sponsorRisk

    const insights = await computeInsights();
    const capacityInsight = insights.find((i) => i.type === "capacity_trend");
    expect(capacityInsight).toBeDefined();
    expect(capacityInsight.severity).toBe("medium"); // 85% is >= 70% but below the 90% "high" threshold
    expect(capacityInsight.message).toMatch(/Hall A/);
  });

  it("returns no insights when every module is quiet", async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ recent: "0" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const insights = await computeInsights();
    expect(insights).toEqual([]);
  });
});
