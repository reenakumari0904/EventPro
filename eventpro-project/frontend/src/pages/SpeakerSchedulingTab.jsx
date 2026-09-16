import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { CalendarClock, Sparkles, CheckCircle2, History, Users, RefreshCw } from "lucide-react";
import Card from "../components/Card";
import { PURPLE, NAVY } from "../theme";
import { apiGet, apiPost, apiPut } from "../api";

const CHART_COLORS = ["#7C5CFC", "#4C9AFF", "#F5A623", "#2FC59B", "#F0678E", "#6D4CF0"];

const labelStyle = { fontSize: 12, color: "#8B87A0", display: "block", marginBottom: 6 };
const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E3E0F1",
  fontSize: 13, outline: "none", boxSizing: "border-box",
};
function Field({ label, ...props }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input style={inputStyle} {...props} />
    </div>
  );
}

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

const ACTION_STYLE = {
  auto_assign: { color: "#2FC59B", bg: "#E3FBF3", label: "Auto-assigned" },
  reschedule: { color: "#4C9AFF", bg: "#EAF3FF", label: "Rescheduled" },
  reassign: { color: "#F5A623", bg: "#FFF3DE", label: "Reassigned" },
};

export default function SpeakerSchedulingTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const [autoResult, setAutoResult] = useState(null);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoError, setAutoError] = useState("");

  // Reschedule an existing session — dynamic schedule-change handling.
  const [sessions, setSessions] = useState([]);
  const [venues, setVenues] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [reForm, setReForm] = useState({ session_id: "", start_time: "", end_time: "", venue_id: "", speaker_id: "" });
  const [reError, setReError] = useState("");
  const [reSuccess, setReSuccess] = useState("");

  const load = () => {
    apiGet("/speakers/scheduling-analytics").then(setData).catch((err) => setError(err.message));
    apiGet("/sessions").then(setSessions).catch(() => {});
    apiGet("/venues").then(setVenues).catch(() => {});
    apiGet("/speakers").then(setSpeakers).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const runAutoSchedule = async () => {
    setAutoError("");
    setAutoLoading(true);
    setAutoResult(null);
    try {
      const result = await apiPost("/speakers/auto-schedule", {});
      setAutoResult(result);
      load();
    } catch (err) {
      setAutoError(err.message);
    } finally {
      setAutoLoading(false);
    }
  };

  const submitReschedule = async (e) => {
    e.preventDefault();
    setReError("");
    setReSuccess("");
    if (!reForm.session_id) {
      setReError("Pick a session to reschedule.");
      return;
    }
    try {
      const { session_id, ...body } = reForm;
      const payload = {
        ...(body.start_time ? { start_time: body.start_time } : {}),
        ...(body.end_time ? { end_time: body.end_time } : {}),
        ...(body.venue_id !== "" ? { venue_id: body.venue_id || null } : {}),
        ...(body.speaker_id !== "" ? { speaker_id: body.speaker_id || null } : {}),
      };
      const result = await apiPut(`/sessions/${session_id}/reschedule`, payload);
      setReSuccess(result.notified ? "Session updated — speaker notified by email." : "Session updated.");
      setReForm({ session_id: "", start_time: "", end_time: "", venue_id: "", speaker_id: "" });
      load();
    } catch (err) {
      setReError(err.message);
    }
  };

  if (error) {
    return (
      <div style={{ fontSize: 13, color: "#C23A5B", background: "#FDE7EC", padding: "10px 14px", borderRadius: 10 }}>
        {error}
      </div>
    );
  }
  if (!data) return <div style={{ fontSize: 13, color: "#9490A8" }}>Loading scheduling data…</div>;

  const workloadChartData = data.speaker_workload.map((w) => ({ name: w.name, count: parseInt(w.session_count, 10) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 16 }}>
        <StatBox
          icon={CheckCircle2}
          label="Scheduling Coverage"
          value={`${data.coverage_pct}%`}
          sub={`${data.sessions_with_speaker} of ${data.total_sessions} sessions have a speaker`}
        />
        <StatBox icon={Users} label="Unscheduled Sessions" value={data.sessions_without_speaker} sub="Still need a speaker assigned" />
        <StatBox icon={History} label="Schedule Actions Logged" value={data.change_log.length} sub="Most recent shown below" />
      </div>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
          <Sparkles size={15} color={PURPLE} /> Auto-Schedule Speakers
        </div>
        <div style={{ fontSize: 12, color: "#9490A8", marginBottom: 16 }}>
          Finds every session with no speaker assigned and matches the best available speaker to each —
          conflict-free by construction, using Gemini reasoning when configured, or topic-keyword matching otherwise.
        </div>
        {autoError && <div style={{ fontSize: 12, color: "#C23A5B", background: "#FDE7EC", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{autoError}</div>}
        <button
          onClick={runAutoSchedule}
          disabled={autoLoading}
          style={{
            background: PURPLE, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10,
            fontSize: 13, fontWeight: 600, cursor: autoLoading ? "not-allowed" : "pointer", opacity: autoLoading ? 0.7 : 1,
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <RefreshCw size={14} /> {autoLoading ? "Scheduling…" : "Run Auto-Schedule"}
        </button>

        {autoResult && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {autoResult.message && <div style={{ fontSize: 12, color: "#9490A8" }}>{autoResult.message}</div>}
            {autoResult.assigned?.map((a) => (
              <div key={a.session_id} style={{ background: "#E3FBF3", padding: "10px 12px", borderRadius: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1E9C74" }}>{a.title} → {a.speaker_name}</div>
                <div style={{ fontSize: 11, color: "#4B4768", fontStyle: "italic", marginTop: 2 }}>"{a.reasoning}"</div>
                <div style={{ fontSize: 10, color: "#1E9C74", marginTop: 2 }}>{a.notified ? "Speaker notified by email." : "Speaker not notified (no email on file / SMTP not configured)."}</div>
              </div>
            ))}
            {autoResult.skipped?.map((s) => (
              <div key={s.session_id} style={{ fontSize: 12, color: "#C23A5B", background: "#FDE7EC", padding: "8px 12px", borderRadius: 8 }}>
                {s.title}: {s.reason}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
          <CalendarClock size={15} color={PURPLE} /> Reschedule a Session
        </div>
        <div style={{ fontSize: 12, color: "#9490A8", marginBottom: 16 }}>
          Change a session's time, venue, or speaker. Rejected if it creates a new conflict; the assigned speaker is emailed automatically.
        </div>
        {reError && <div style={{ fontSize: 12, color: "#C23A5B", background: "#FDE7EC", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{reError}</div>}
        {reSuccess && <div style={{ fontSize: 12, color: "#1E9C74", background: "#E3FBF3", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{reSuccess}</div>}
        <form onSubmit={submitReschedule} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Session</label>
            <select style={inputStyle} value={reForm.session_id} onChange={(e) => setReForm({ ...reForm, session_id: e.target.value })} required>
              <option value="">Select a session</option>
              {sessions.map((s) => <option key={s.session_id} value={s.session_id}>{s.title} — {new Date(s.start_time).toLocaleString()}</option>)}
            </select>
          </div>
          <Field label="New Start Time" type="datetime-local" value={reForm.start_time} onChange={(e) => setReForm({ ...reForm, start_time: e.target.value })} />
          <Field label="New End Time" type="datetime-local" value={reForm.end_time} onChange={(e) => setReForm({ ...reForm, end_time: e.target.value })} />
          <div>
            <label style={labelStyle}>New Venue (optional)</label>
            <select style={inputStyle} value={reForm.venue_id} onChange={(e) => setReForm({ ...reForm, venue_id: e.target.value })}>
              <option value="">Keep current venue</option>
              {venues.map((v) => <option key={v.venue_id} value={v.venue_id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>New Speaker (optional)</label>
            <select style={inputStyle} value={reForm.speaker_id} onChange={(e) => setReForm({ ...reForm, speaker_id: e.target.value })}>
              <option value="">Keep current speaker</option>
              {speakers.map((s) => <option key={s.speaker_id} value={s.speaker_id}>{s.name}</option>)}
            </select>
          </div>
          <button type="submit" style={{ gridColumn: "1 / -1", background: NAVY, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Save Schedule Change
          </button>
        </form>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 10 }}>Speaker Workload</div>
          <div style={{ fontSize: 11, color: "#9490A8", marginBottom: 10 }}>Sessions assigned per speaker.</div>
          {workloadChartData.length === 0 ? (
            <div style={{ fontSize: 12, color: "#B0ACC4" }}>No speakers yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={workloadChartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F0EEF8" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#9490A8" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: "#4B4768" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E3E0F1" }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {workloadChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 10 }}>Upcoming Schedule</div>
          {data.upcoming_schedule.length === 0 ? (
            <div style={{ fontSize: 12, color: "#B0ACC4" }}>No upcoming sessions.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.upcoming_schedule.map((s) => (
                <div key={s.session_id} style={{ padding: "8px 10px", borderRadius: 10, background: "#F9F8FD" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: "#9490A8" }}>
                    {s.speaker_name || "No speaker"} · {s.venue_name || "No venue"} · {new Date(s.start_time).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 4 }}>Schedule Change History</div>
        <div style={{ fontSize: 11, color: "#9490A8", marginBottom: 12 }}>
          Every auto-assignment and reschedule the engine has made, most recent first.
        </div>
        {data.change_log.length === 0 ? (
          <div style={{ fontSize: 12, color: "#B0ACC4" }}>No scheduling actions yet — run auto-schedule or reschedule a session above.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.change_log.map((h) => {
              const style = ACTION_STYLE[h.action] || ACTION_STYLE.reschedule;
              return (
                <div key={h.log_id} style={{ padding: "10px 12px", borderRadius: 10, background: "#F9F8FD" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{h.session_title}</div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: style.color, background: style.bg, padding: "3px 8px", borderRadius: 999 }}>
                      {style.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#9490A8", marginTop: 3 }}>
                    {h.speaker_name || "No speaker"} · new time: {new Date(h.new_start_time).toLocaleString()} · {h.notified ? "notified" : "not notified"} · {new Date(h.created_at).toLocaleString()}
                  </div>
                  {h.reasoning && <div style={{ fontSize: 11, color: "#6D4CF0", fontStyle: "italic", marginTop: 4 }}>"{h.reasoning}"</div>}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
