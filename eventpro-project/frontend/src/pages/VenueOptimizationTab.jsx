import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Gauge, TrendingUp, TrendingDown, CheckCircle2, History } from "lucide-react";
import Card from "../components/Card";
import { PURPLE, NAVY } from "../theme";
import { apiGet } from "../api";

const CHART_COLORS = ["#7C5CFC", "#4C9AFF", "#F5A623", "#2FC59B", "#F0678E", "#6D4CF0"];

function StatBox({ icon: Icon, label, value, sub }) {
  return (
    <Card style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Icon size={15} color={PURPLE} />
        <div style={{ fontSize: 12, color: "#8B87A0" }}>{label}</div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: NAVY }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#9490A8", marginTop: 2 }}>{sub}</div>}
    </Card>
  );
}

const SUGGESTION_STYLE = {
  match: { color: "#2FC59B", bg: "#E3FBF3", icon: CheckCircle2, label: "Good Match" },
  upgrade: { color: "#4C9AFF", bg: "#EAF3FF", icon: TrendingUp, label: "Upgrade Suggested" },
  downgrade: { color: "#F5A623", bg: "#FFF3DE", icon: TrendingDown, label: "Downgrade Suggested" },
};

export default function VenueOptimizationTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet("/venues/optimization-analytics").then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div style={{ fontSize: 13, color: "#C23A5B", background: "#FDE7EC", padding: "10px 14px", borderRadius: 10 }}>
        {error}
      </div>
    );
  }
  if (!data) {
    return <div style={{ fontSize: 13, color: "#9490A8" }}>Loading optimization data…</div>;
  }

  const utilizationChartData = data.venue_utilization
    .filter((v) => v.avg_utilization_pct !== null)
    .map((v) => ({ name: v.name, value: parseFloat(v.avg_utilization_pct) }));

  const peakHoursData = data.peak_hours.map((h) => ({
    name: `${String(h.hour).padStart(2, "0")}:00`,
    value: parseInt(h.session_count, 10),
  }));

  const totalWasted = data.venue_utilization.reduce((sum, v) => sum + parseInt(v.wasted_capacity || 0, 10), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 16 }}>
        <StatBox
          icon={Gauge}
          label="Optimization Score"
          value={data.optimization_score !== null ? `${data.optimization_score}%` : "—"}
          sub={`From ${data.total_recommendations} AI recommendation(s)`}
        />
        <StatBox
          icon={TrendingDown}
          label="Wasted Capacity (seats)"
          value={totalWasted}
          sub="Total empty seats across booked sessions"
        />
        <StatBox
          icon={History}
          label="Recommendations Logged"
          value={data.total_recommendations}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 10 }}>Capacity Efficiency by Venue</div>
          <div style={{ fontSize: 11, color: "#9490A8", marginBottom: 10 }}>
            Average % of each venue's seats actually filled by booked sessions.
          </div>
          {utilizationChartData.length === 0 ? (
            <div style={{ fontSize: 12, color: "#B0ACC4" }}>No sessions booked yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={utilizationChartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F0EEF8" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#9490A8" }} axisLine={false} tickLine={false} unit="%" />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: "#4B4768" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E3E0F1" }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {utilizationChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 10 }}>Peak Occupancy Hours</div>
          <div style={{ fontSize: 11, color: "#9490A8", marginBottom: 10 }}>
            How many sessions start at each hour of the day.
          </div>
          {peakHoursData.length === 0 ? (
            <div style={{ fontSize: 12, color: "#B0ACC4" }}>No sessions scheduled yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={peakHoursData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0EEF8" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9490A8" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9490A8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E3E0F1" }} />
                <Bar dataKey="value" fill={PURPLE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 4 }}>Wasted Capacity by Venue</div>
        <div style={{ fontSize: 11, color: "#9490A8", marginBottom: 12 }}>
          Total unused seats (capacity minus expected attendees, summed across bookings).
        </div>
        {data.venue_utilization.length === 0 ? (
          <div style={{ fontSize: 12, color: "#B0ACC4" }}>No venues yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.venue_utilization.map((v) => (
              <div key={v.venue_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #F0EEF8" }}>
                <div style={{ fontSize: 13, color: NAVY, fontWeight: 600 }}>{v.name}</div>
                <div style={{ fontSize: 12, color: "#9490A8" }}>
                  {v.sessions_booked} session(s) · {v.avg_utilization_pct !== null ? `${v.avg_utilization_pct}% avg utilization` : "no bookings"}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: v.wasted_capacity > 0 ? "#F5A623" : "#2FC59B" }}>
                  {v.wasted_capacity} wasted seats
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 4 }}>AI Recommendation History</div>
        <div style={{ fontSize: 11, color: "#9490A8", marginBottom: 12 }}>
          Every recommendation the Venue Optimization Engine has generated, most recent first.
        </div>
        {data.recommendation_history.length === 0 ? (
          <div style={{ fontSize: 12, color: "#B0ACC4" }}>
            No recommendations yet — use "Ask AI to Recommend a Venue" on the Venues tab to generate one.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.recommendation_history.map((h) => {
              const style = SUGGESTION_STYLE[h.suggestion_type] || SUGGESTION_STYLE.match;
              const Icon = style.icon;
              return (
                <div key={h.recommendation_id} style={{ padding: "10px 12px", borderRadius: 10, background: "#F9F8FD" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{h.session_title}</div>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, color: style.color, background: style.bg, padding: "3px 8px", borderRadius: 999 }}>
                      <Icon size={11} /> {style.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#9490A8", marginTop: 3 }}>
                    {h.venue_name || "No venue"} · {h.expected_attendees} attendees · {h.capacity_match_pct}% capacity match · {new Date(h.created_at).toLocaleString()}
                  </div>
                  {h.reasoning && (
                    <div style={{ fontSize: 11, color: "#6D4CF0", fontStyle: "italic", marginTop: 4 }}>"{h.reasoning}"</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
