import React, { useState, useEffect, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Gauge, Users, CalendarClock, Star, Handshake, Siren, Bell, Sparkles, TrendingUp, AlertTriangle,
  Radio, CheckCircle2, XCircle, Zap, MapPinned, Mic, Percent,
} from "lucide-react";
import Card from "../components/Card";
import { PURPLE, NAVY } from "../theme";
import { apiGet, apiPost, apiStream } from "../api";

const ACTION_STYLE = {
  critical: { color: "#C23A5B", bg: "#FDE7EC" },
  high: { color: "#C23A5B", bg: "#FDE7EC" },
  medium: { color: "#B08900", bg: "#FFF8DE" },
  low: { color: "#3D7A5C", bg: "#E7F6EE" },
  informational: { color: "#6B6580", bg: "#F0EEF8" },
};

function LiveCommandCenter() {
  const [report, setReport] = useState(null);
  const [connError, setConnError] = useState("");
  const [live, setLive] = useState(true);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!live) {
      closeRef.current?.();
      return;
    }
    setConnError("");
    closeRef.current = apiStream("/orchestration/stream", {
      intervalMs: 8000,
      onReport: (r) => { setReport(r); setConnError(""); },
      onError: (err) => setConnError(err.message),
    });
    return () => closeRef.current?.();
  }, [live]);

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: NAVY }}>
          <Radio size={15} color={live ? "#2FC59B" : "#B0ACC4"} /> Live Command Center
        </div>
        <button
          onClick={() => setLive((v) => !v)}
          style={{
            background: live ? "#E7F6EE" : "#F0EEF8", color: live ? "#3D7A5C" : "#6B6580",
            border: "none", padding: "6px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer",
          }}
        >
          {live ? "● Live" : "Paused — resume"}
        </button>
      </div>
      <div style={{ fontSize: 12, color: "#9490A8", marginBottom: 12 }}>
        Every agent below runs on a short interval and feeds one ranked list of what needs attention next.
      </div>

      {connError && <div style={{ fontSize: 12, color: "#C23A5B", background: "#FDE7EC", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{connError}</div>}

      {!report ? (
        <div style={{ fontSize: 12, color: "#9490A8" }}>Connecting to agents…</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {report.agents.map((a) => (
              <div key={a.name} style={{
                display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600,
                padding: "5px 10px", borderRadius: 999,
                background: a.status === "ok" ? "#E7F6EE" : "#FDE7EC",
                color: a.status === "ok" ? "#3D7A5C" : "#C23A5B",
              }}>
                {a.status === "ok" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                {a.name}{a.status === "ok" ? ` · ${a.duration_ms}ms` : ""}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
            <Zap size={14} color={PURPLE} /> Priority Actions ({report.priority_actions.length})
          </div>
          {report.priority_actions.length === 0 ? (
            <div style={{ fontSize: 12, color: "#B0ACC4" }}>Nothing needs attention right now.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
              {report.priority_actions.map((a, idx) => {
                const style = ACTION_STYLE[a.severity] || ACTION_STYLE.medium;
                return (
                  <div key={idx} style={{ padding: "9px 12px", borderRadius: 10, background: "#F9F8FD" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: style.color, background: style.bg, padding: "2px 8px", borderRadius: 999, textTransform: "uppercase" }}>{a.severity}</span>
                      <span style={{ fontSize: 9, color: "#B0ACC4", textTransform: "uppercase", letterSpacing: 0.4 }}>{a.source}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{a.title}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#4B4768", marginTop: 3 }}>{a.message}</div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ fontSize: 10, color: "#B0ACC4", marginTop: 10 }}>
            Last updated {new Date(report.run_at).toLocaleTimeString()} · pass took {report.duration_ms}ms
          </div>
        </>
      )}
    </Card>
  );
}

const CHART_COLORS = ["#7C5CFC", "#4C9AFF", "#F5A623", "#2FC59B", "#F0678E", "#6D4CF0"];

function healthColor(score) {
  if (score >= 80) return "#2FC59B";
  if (score >= 60) return "#F5A623";
  return "#C23A5B";
}

function StatBox({ icon: Icon, label, value, sub }) {
  return (
    <Card style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Icon size={15} color={PURPLE} />
        <div style={{ fontSize: 12, color: "#8B87A0" }}>{label}</div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: NAVY }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#9490A8", marginTop: 2 }}>{sub}</div>}
    </Card>
  );
}

const INSIGHT_STYLE = {
  high: { color: "#C23A5B", bg: "#FDE7EC" },
  medium: { color: "#B08900", bg: "#FFF8DE" },
  informational: { color: "#6B6580", bg: "#F0EEF8" },
};

function MetricRow({ label, value, sub }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid #F5F4FA" }}>
      <div style={{ fontSize: 12, color: "#8B87A0" }}>{label}</div>
      <div style={{ textAlign: "right" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{value}</span>
        {sub && <div style={{ fontSize: 10, color: "#B0ACC4" }}>{sub}</div>}
      </div>
    </div>
  );
}

// Milestone 3 — dashboard KPI parity with the brief's "Example Executive
// View": Venue Performance, Speaker Performance, and a Sponsor ROI figure,
// each as its own scannable block rather than buried in a bigger table.
function PerformanceSection({ overview }) {
  const v = overview.venue_performance;
  const s = overview.speaker_performance;
  const roi = overview.sponsorship.roi_pct;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
          <MapPinned size={15} color={PURPLE} /> Venue Performance
        </div>
        <MetricRow label="Utilization" value={v.utilization_pct !== null ? `${v.utilization_pct}%` : "—"} sub={`${v.venues_in_use} / ${v.total_venues} venues in use`} />
        <MetricRow label="Avg. Hall Occupancy" value={v.avg_hall_occupancy_pct !== null ? `${v.avg_hall_occupancy_pct}%` : "—"} sub="capacity filled per session" />
      </Card>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
          <Mic size={15} color={PURPLE} /> Speaker Performance
        </div>
        <MetricRow label="Sessions Conducted" value={s.sessions_conducted} />
        <MetricRow label="Speaker Participation" value={s.participation_pct !== null ? `${s.participation_pct}%` : "—"} sub={`${s.speakers_participating} / ${s.total_speakers} speakers`} />
        <MetricRow label="Audience Engagement" value={s.avg_audience_engagement_rating !== null ? `${s.avg_audience_engagement_rating} / 5` : "—"} sub="avg. speaker rating" />
      </Card>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
          <Percent size={15} color={PURPLE} /> Sponsor ROI
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, color: healthColor(roi ?? 0) }}>{roi !== null ? `${roi}%` : "—"}</div>
        <div style={{ fontSize: 11, color: "#9490A8", marginTop: 4 }}>
          Conversions ÷ leads logged across all sponsors — a conversion-rate proxy, not a financial return figure (the platform has no revenue-attribution data for that).
        </div>
      </Card>
    </div>
  );
}

export default function ExecutiveDashboardPage() {
  const [overview, setOverview] = useState(null);
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState("");
  const [briefing, setBriefing] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState("");

  const load = () => {
    apiGet("/intelligence/overview").then(setOverview).catch((err) => setError(err.message));
    apiGet("/intelligence/insights").then(setInsights).catch((err) => setError(err.message));
  };
  useEffect(() => { load(); }, []);

  const generateBriefing = async () => {
    setBriefingError(""); setBriefing(null); setBriefingLoading(true);
    try {
      const result = await apiPost("/intelligence/ai-briefing", {});
      setBriefing(result.briefing);
    } catch (err) { setBriefingError(err.message); } finally { setBriefingLoading(false); }
  };

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ fontSize: 13, color: "#C23A5B", background: "#FDE7EC", padding: "10px 14px", borderRadius: 10 }}>{error}</div>
      </div>
    );
  }
  if (!overview || !insights) {
    return <div style={{ padding: 24, fontSize: 13, color: "#9490A8" }}>Loading executive overview…</div>;
  }

  const score = overview.event_health_score;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 20, alignItems: "stretch" }}>
        <Card style={{ flex: "0 0 220px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 12, color: "#8B87A0", marginBottom: 6 }}>Event Health Score</div>
          <div style={{ fontSize: 44, fontWeight: 800, color: healthColor(score) }}>{score}</div>
          <div style={{ fontSize: 11, color: "#9490A8" }}>out of 100</div>
        </Card>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 16 }}>
            <StatBox icon={Users} label="Check-in Rate" value={overview.registration.checkin_rate_pct !== null ? `${overview.registration.checkin_rate_pct}%` : "—"} sub={`${overview.registration.checked_in} / ${overview.registration.total} registered`} />
            <StatBox icon={CalendarClock} label="Scheduling Coverage" value={overview.scheduling.coverage_pct !== null ? `${overview.scheduling.coverage_pct}%` : "—"} sub={`${overview.scheduling.sessions_with_speaker} / ${overview.scheduling.total_sessions} sessions`} />
            <StatBox icon={Star} label="Avg. Session Rating" value={overview.session_performance.avg_rating !== null ? `${overview.session_performance.avg_rating} / 5` : "—"} />
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <StatBox icon={Handshake} label="Sponsor Revenue Collected" value={`₹${overview.sponsorship.total_paid.toLocaleString()}`} sub={`of ₹${overview.sponsorship.total_contracted.toLocaleString()} contracted`} />
            <StatBox icon={Siren} label="Open Incidents" value={overview.incidents.critical_open + overview.incidents.high_open} sub={`${overview.incidents.critical_open} critical, ${overview.incidents.high_open} high`} />
            <StatBox icon={Bell} label="Unacknowledged Alerts" value={overview.alerts.unacknowledged_by_level.reduce((sum, a) => sum + parseInt(a.count, 10), 0)} />
          </div>
        </div>
      </div>

      <PerformanceSection overview={overview} />

      <LiveCommandCenter />

      {overview.score_deductions.length > 0 && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
            <AlertTriangle size={15} color="#C23A5B" /> Why the score isn't 100
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {overview.score_deductions.map((d, i) => (
              <div key={i} style={{ fontSize: 12, color: "#4B4768" }}>• {d}</div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
          <Sparkles size={15} color={PURPLE} /> AI Executive Briefing
        </div>
        <div style={{ fontSize: 12, color: "#9490A8", marginBottom: 12 }}>
          A 15-second read of the whole event's current state, generated from the same live data above.
        </div>
        {briefingError && <div style={{ fontSize: 12, color: "#C23A5B", background: "#FDE7EC", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{briefingError}</div>}
        <button onClick={generateBriefing} disabled={briefingLoading} style={{ background: PURPLE, color: "#fff", border: "none", padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {briefingLoading ? "Generating…" : "Generate Briefing"}
        </button>
        {briefing && <div style={{ marginTop: 12, background: "#F3F1FE", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#4B4768", lineHeight: 1.5 }}>{briefing}</div>}
      </Card>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
          <TrendingUp size={15} color={PURPLE} /> Patterns, Trends & Risks
        </div>
        <div style={{ fontSize: 12, color: "#9490A8", marginBottom: 12 }}>
          Detected automatically by combining venue capacity, scheduling, and sponsor data — not raw metrics, actionable calls.
        </div>
        {insights.insights.length === 0 ? (
          <div style={{ fontSize: 12, color: "#B0ACC4" }}>No active patterns or risks detected right now.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {insights.insights.map((ins, idx) => {
              const style = INSIGHT_STYLE[ins.severity] || INSIGHT_STYLE.medium;
              return (
                <div key={idx} style={{ padding: "10px 12px", borderRadius: 10, background: "#F9F8FD" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: style.color, background: style.bg, padding: "3px 9px", borderRadius: 999, textTransform: "uppercase" }}>{ins.severity}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{ins.title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#4B4768", marginTop: 4 }}>{ins.message}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 10 }}>Open Incidents by Severity</div>
          {overview.incidents.open_by_severity.length === 0 ? (
            <div style={{ fontSize: 12, color: "#B0ACC4" }}>No open incidents.</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={overview.incidents.open_by_severity.map((s) => ({ name: s.severity, value: parseInt(s.count, 10) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0EEF8" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9490A8" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9490A8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E3E0F1" }} />
                <Bar dataKey="value" fill={PURPLE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 10 }}>Unacknowledged Alerts by Level</div>
          {overview.alerts.unacknowledged_by_level.length === 0 ? (
            <div style={{ fontSize: 12, color: "#B0ACC4" }}>No unacknowledged alerts.</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={overview.alerts.unacknowledged_by_level.map((a) => ({ name: a.alert_level, value: parseInt(a.count, 10) }))} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F0EEF8" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#9490A8" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "#4B4768" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E3E0F1" }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {overview.alerts.unacknowledged_by_level.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}
