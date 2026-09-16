import React, { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import Card from "../components/Card";
import Donut from "../components/Donut";
import { PURPLE, NAVY } from "../theme";
import { apiGet } from "../api";

const TICKET_COLORS = { Standard: "#7C5CFC", VIP: "#F5A623", Student: "#2FC59B", Others: "#B9B4D9" };
const SOURCE_COLORS = {
  Website: "#7C5CFC",
  "Mobile App": "#4C9AFF",
  "Google Forms": "#F5A623",
  "CSV Upload": "#F0678E",
  API: "#2FC59B",
  "Registration Link": "#00C2A8",
  "Admin Panel": "#9B59B6",
  "Website Registration": "#FF7A5C",
  "Admin Dashboard": "#5C7CFA",
  Others: "#B9B4D9",
};
const GENDER_COLORS = { Male: "#4C9AFF", Female: "#F0678E", Other: "#F5A623" };
const AGE_GROUP_ORDER = ["<18", "18-24", "25-34", "35-44", "45+"];

function toDonutData(rows, keyField, colorMap) {
  const total = rows.reduce((sum, r) => sum + parseInt(r.count, 10), 0);
  if (total === 0) return [];
  return rows.map((r) => ({
    name: r[keyField],
    value: parseInt(r.count, 10),
    pct: Math.round((parseInt(r.count, 10) / total) * 100),
    color: colorMap[r[keyField]] || "#B9B4D9",
  }));
}

function EmptyState({ text }) {
  return <div style={{ padding: "30px 0", textAlign: "center", fontSize: 12, color: "#B0ACC4" }}>{text}</div>;
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet("/analytics").then(setAnalytics).catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ fontSize: 13, color: "#C23A5B", background: "#FDE7EC", padding: "10px 14px", borderRadius: 10 }}>
          Could not load analytics: {error}.
        </div>
      </div>
    );
  }
  if (!analytics) {
    return <div style={{ padding: 24, fontSize: 13, color: "#9490A8" }}>Loading…</div>;
  }

  const trendData = analytics.trend || [];
  const ticketData = toDonutData(analytics.by_ticket_type || [], "ticket_type", TICKET_COLORS);
  const sourceData = toDonutData(analytics.by_source || [], "source", SOURCE_COLORS);
  const ticketTotal = ticketData.reduce((s, d) => s + d.value, 0);
  const sourceTotal = sourceData.reduce((s, d) => s + d.value, 0);

  const genderRows = analytics.by_gender || [];
  const genderTotal = genderRows.reduce((s, r) => s + parseInt(r.count, 10), 0);
  const genderData = genderRows.map((r) => ({
    name: r.gender,
    pct: Math.round((parseInt(r.count, 10) / genderTotal) * 100),
    color: GENDER_COLORS[r.gender] || "#B9B4D9",
  }));

  const ageRows = analytics.by_age_group || [];
  const ageDataToShow = AGE_GROUP_ORDER.map((name) => {
    const row = ageRows.find((r) => r.name === name);
    return { name, value: row ? parseInt(row.value, 10) : 0 };
  });

  const interestRows = analytics.by_interest || [];
  const interestTotal = interestRows.reduce((s, r) => s + parseInt(r.count, 10), 0);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 20 }}>
        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 12 }}>Registrations Over Time</div>
          {trendData.length === 0 ? (
            <EmptyState text="No registrations yet." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0EEF8" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9490A8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9490A8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke={PURPLE} strokeWidth={3} dot={{ r: 4, fill: PURPLE }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 12 }}>By Ticket Type</div>
          {ticketData.length === 0 ? <EmptyState text="No data yet." /> : (
            <Donut data={ticketData} total={ticketTotal.toLocaleString()} label="Total" />
          )}
        </Card>
        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 12 }}>By Source</div>
          {sourceData.length === 0 ? <EmptyState text="No data yet." /> : (
            <Donut data={sourceData} total={sourceTotal.toLocaleString()} label="Total" />
          )}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 12 }}>Gender Distribution</div>
          {genderTotal === 0 ? (
            <EmptyState text="No gender data yet." />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 90, height: 90 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={genderData} dataKey="pct" innerRadius={28} outerRadius={44} stroke="none">
                      {genderData.map((g, i) => <Cell key={i} fill={g.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {genderData.map((g, i) => (
                  <div key={i}><span style={{ color: g.color }}>●</span> {g.name} {g.pct}%</div>
                ))}
              </div>
            </div>
          )}
        </Card>
        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 12 }}>Age Distribution</div>
          {ageRows.length === 0 ? (
            <EmptyState text="No age data yet." />
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={ageDataToShow}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9490A8" }} axisLine={false} tickLine={false} />
                <Bar dataKey="value" fill={PURPLE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 12 }}>Top Interests</div>
          {interestRows.length === 0 ? (
            <EmptyState text="No interest data yet." />
          ) : (
            interestRows.map((r, i) => {
              const pct = Math.round((parseInt(r.count, 10) / interestTotal) * 100);
              return (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "#4B4768" }}>{r.interest}</span>
                    <span style={{ fontWeight: 600, color: NAVY }}>{pct}%</span>
                  </div>
                  <div style={{ height: 6, background: "#EFEDF7", borderRadius: 999 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: PURPLE, borderRadius: 999 }} />
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </div>
    </div>
  );
}