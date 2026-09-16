import React, { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import {
  Users, CheckCircle2, Clock, X as XIcon, UserPlus, Download, ChevronDown, QrCode, BadgeCheck,
} from "lucide-react";
import Card from "../components/Card";
import StatCard from "../components/StatCard";
import Donut from "../components/Donut";
import { PURPLE, NAVY } from "../theme";
import { apiGet } from "../api";
import { exportDashboardPdf } from "../utils/exportPdf";

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
  return (
    <div style={{ padding: "30px 0", textAlign: "center", fontSize: 12, color: "#B0ACC4" }}>{text}</div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState("");
  const [recentAttendees, setRecentAttendees] = useState(null);
  const [attendeesError, setAttendeesError] = useState("");

  useEffect(() => {
    apiGet("/dashboard").then(setStats).catch((err) => setStatsError(err.message));
    apiGet("/analytics").then(setAnalytics).catch((err) => setAnalyticsError(err.message));
    apiGet("/attendees")
      .then((data) =>
        setRecentAttendees(
          data.slice(0, 5).map((r) => ({
            name: r.name,
            email: r.email,
            status: r.checkin_time ? "Checked-In" : "Not Checked-In",
            time: r.checkin_time ? new Date(r.checkin_time).toLocaleString() : "-",
          }))
        )
      )
      .catch((err) => setAttendeesError(err.message));
  }, []);


  const trendData = analytics?.trend || [];
  const ticketData = toDonutData(analytics?.by_ticket_type || [], "ticket_type", TICKET_COLORS);
  const sourceData = toDonutData(analytics?.by_source || [], "source", SOURCE_COLORS);
  const ticketTotal = ticketData.reduce((s, d) => s + d.value, 0);
  const sourceTotal = sourceData.reduce((s, d) => s + d.value, 0);
  const checkinsToShow = recentAttendees || [];

  const genderRows = analytics?.by_gender || [];
  const genderTotal = genderRows.reduce((s, r) => s + parseInt(r.count, 10), 0);
  const genderData = genderRows.map((r) => ({
    name: r.gender,
    pct: Math.round((parseInt(r.count, 10) / genderTotal) * 100),
    color: GENDER_COLORS[r.gender] || "#B9B4D9",
  }));

  const ageRows = analytics?.by_age_group || [];
  const ageDataToShow = AGE_GROUP_ORDER.map((name) => {
    const row = ageRows.find((r) => r.name === name);
    return { name, value: row ? parseInt(row.value, 10) : 0 };
  });
  const hasRealAge = ageRows.length > 0;

  const interestRows = analytics?.by_interest || [];
  const interestTotal = interestRows.reduce((s, r) => s + parseInt(r.count, 10), 0);
  const interestData = interestRows.map((r) => [
    r.interest,
    Math.round((parseInt(r.count, 10) / interestTotal) * 100),
  ]);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {statsError && (
        <div style={{ fontSize: 13, color: "#C23A5B", background: "#FDE7EC", padding: "10px 14px", borderRadius: 10 }}>
          Could not load live stats: {statsError}. Is the backend running on localhost:5000?
        </div>
      )}
      {analyticsError && (
        <div style={{ fontSize: 13, color: "#C23A5B", background: "#FDE7EC", padding: "10px 14px", borderRadius: 10 }}>
          Could not load live charts: {analyticsError}.
        </div>
      )}
      {attendeesError && (
        <div style={{ fontSize: 13, color: "#C23A5B", background: "#FDE7EC", padding: "10px 14px", borderRadius: 10 }}>
          Could not load attendees: {attendeesError}.
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <StatCard label="Total Registrations" value={stats ? stats.total_registrations : "…"} delta="—" up icon={Users} iconBg="#EDE7FF" iconColor={PURPLE} />
        <StatCard label="Confirmed Registrations" value={stats ? stats.confirmed_registrations : "…"} delta="—" up icon={BadgeCheck} iconBg="#EDE7FF" iconColor={PURPLE} />
        <StatCard label="Checked-In" value={stats ? stats.checked_in : "…"} delta="—" up icon={CheckCircle2} iconBg="#E3FBF3" iconColor="#2FC59B" />
        <StatCard label="Pending Check-In" value={stats ? stats.pending_checkin : "…"} delta="—" icon={Clock} iconBg="#FFF3DE" iconColor="#F5A623" />
        <StatCard label="Cancelled" value={stats ? stats.cancelled : "…"} delta="—" icon={XIcon} iconBg="#FDE7EC" iconColor="#F0678E" />
        <StatCard label="Waitlisted" value={stats ? stats.waitlisted : "…"} delta="—" up icon={UserPlus} iconBg="#FFF3DE" iconColor="#F5A623" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 20 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 700, color: NAVY }}>Registrations Over Time</div>
            <div style={{ fontSize: 12, color: "#8B87A0", display: "flex", alignItems: "center", gap: 4 }}>
              Daily <ChevronDown size={13} />
            </div>
          </div>
          {trendData.length === 0 ? (
            <EmptyState text="No registrations yet — data will appear here once attendees register." />
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
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 12 }}>Registrations by Ticket Type</div>
          {ticketData.length === 0 ? (
            <EmptyState text="No registrations yet." />
          ) : (
            <Donut data={ticketData} total={ticketTotal.toLocaleString()} label="Total" />
          )}
        </Card>
        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 12 }}>Registrations by Source</div>
          {sourceData.length === 0 ? (
            <EmptyState text="No registrations yet." />
          ) : (
            <Donut data={sourceData} total={sourceTotal.toLocaleString()} label="Total" />
          )}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 20 }}>
        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 4 }}>Check-in Tracking</div>
          <div style={{ fontSize: 12, color: "#9490A8", marginBottom: 16 }}>Scan QR Code to check-in attendees</div>
          <div
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              border: "2px dashed #D8D3EE", borderRadius: 14, padding: "28px 0",
            }}
          >
            <QrCode size={110} color={NAVY} />
            <div style={{ fontSize: 12, color: "#8B87A0", marginTop: 10 }}>Scan QR Code</div>
          </div>
        </Card>
        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 12 }}>Recent Check-ins</div>
          {checkinsToShow.length === 0 ? (
            <EmptyState text="No attendees registered yet." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {checkinsToShow.map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 34, height: 34, borderRadius: "50%", background: "#EDE7FF", color: PURPLE,
                        display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13,
                      }}
                    >
                      {a.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: "#9490A8" }}>{a.email}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "#9490A8" }}>{a.time}</div>
                    <span
                      style={{
                        fontSize: 11, fontWeight: 600,
                        color: a.status === "Checked-In" ? "#2FC59B" : "#F0678E",
                        background: a.status === "Checked-In" ? "#E3FBF3" : "#FDE7EC",
                        padding: "2px 8px", borderRadius: 999,
                      }}
                    >
                      {a.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: NAVY, fontSize: 16 }}>Analytics & AI Insights</div>
          <button
            onClick={exportDashboardPdf}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: PURPLE, color: "#fff", border: "none",
              padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            <Download size={13} /> Export Report
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 10 }}>Demographics</div>
            {genderTotal === 0 ? (
              <EmptyState text="No gender data yet — ask attendees to fill it in when registering." />
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
            <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, margin: "16px 0 8px" }}>Age Distribution</div>
            {!hasRealAge ? (
              <EmptyState text="No age data yet." />
            ) : (
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={ageDataToShow}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9490A8" }} axisLine={false} tickLine={false} />
                  <Bar dataKey="value" fill={PURPLE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 10 }}>Top Interests</div>
            {interestData.length === 0 ? (
              <EmptyState text="No interest data yet." />
            ) : (
              interestData.map(([n, p], i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "#4B4768" }}>{n}</span>
                    <span style={{ fontWeight: 600, color: NAVY }}>{p}%</span>
                  </div>
                  <div style={{ height: 6, background: "#EFEDF7", borderRadius: 999 }}>
                    <div style={{ width: `${p}%`, height: "100%", background: PURPLE, borderRadius: 999 }} />
                  </div>
                </div>
              ))
            )}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 10 }}>AI Insights</div>
            <EmptyState text="AI-generated insights need an ML/LLM service, which isn't connected yet — this section will stay empty until that's built." />
          </div>
        </div>
      </Card>
    </div>
  );
}