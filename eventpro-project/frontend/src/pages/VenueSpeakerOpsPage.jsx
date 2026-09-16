import React, { useState, useEffect } from "react";
import { Building2, Mic2, CalendarClock, BarChart3, Sparkles, CheckCircle2, Pencil, Trash2, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import Card from "../components/Card";
import { PURPLE, NAVY } from "../theme";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";
import VenueOptimizationTab from "./VenueOptimizationTab";
import SpeakerSchedulingTab from "./SpeakerSchedulingTab";
import { Gauge } from "lucide-react";

const CHART_COLORS = ["#7C5CFC", "#4C9AFF", "#F5A623", "#2FC59B", "#F0678E", "#6D4CF0"];

const TABS = [
  { key: "venues", label: "Venues", icon: Building2 },
  { key: "speakers", label: "Speakers", icon: Mic2 },
  { key: "sessions", label: "Sessions", icon: CalendarClock },
  { key: "scheduling", label: "Speaker Scheduling", icon: CalendarClock },
  { key: "analytics", label: "Session Analytics", icon: BarChart3 },
  { key: "optimization", label: "Venue Optimization", icon: Gauge },
];

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

export default function VenueSpeakerOpsPage() {
  const [tab, setTab] = useState("venues");

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 999,
                border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                background: active ? PURPLE : "#F1EFFB", color: active ? "#fff" : "#4B4768",
              }}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "venues" && <VenuesTab />}
      {tab === "speakers" && <SpeakersTab />}
      {tab === "sessions" && <SessionsTab />}
      {tab === "scheduling" && <SpeakerSchedulingTab />}
      {tab === "analytics" && <SessionAnalyticsTab />}
      {tab === "optimization" && <VenueOptimizationTab />}
    </div>
  );
}

// ---------------- Venue Agent ----------------
function VenuesTab() {
  const [venues, setVenues] = useState(null);
  const [form, setForm] = useState({ name: "", location: "", capacity: "", amenities: "" });
  const [editingId, setEditingId] = useState(null); // venue_id currently being edited, or null
  const [suggestForm, setSuggestForm] = useState({ expected_attendees: "", start_time: "", end_time: "" });
  const [suggestion, setSuggestion] = useState(null);
  const [error, setError] = useState("");

  // Real AI (Gemini) venue recommendation — separate state/form because it
  // takes extra context (title, track, amenities needed) that the plain
  // rule-based suggester above doesn't use.
  const [aiForm, setAiForm] = useState({ title: "", track: "", expected_attendees: "", amenities_needed: "", start_time: "", end_time: "" });
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const load = () => apiGet("/venues").then(setVenues).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  const startEdit = (v) => {
    setEditingId(v.venue_id);
    setForm({ name: v.name, location: v.location || "", capacity: String(v.capacity), amenities: v.amenities || "" });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setForm({ name: "", location: "", capacity: "", amenities: "" });
  };

  const saveVenue = async (e) => {
    e.preventDefault();
    setError("");
    const payload = { ...form, capacity: parseInt(form.capacity, 10) };
    try {
      if (editingId) {
        await apiPut(`/venues/${editingId}`, payload);
      } else {
        await apiPost("/venues", payload);
      }
      cancelEdit();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeVenue = async (id) => {
    if (!window.confirm("Delete this venue? This can't be undone.")) return;
    setError("");
    try {
      await apiDelete(`/venues/${id}`);
      load();
    } catch (err) {
      setError(err.message); // e.g. "Can't delete a venue that has sessions scheduled in it."
    }
  };

  const findVenue = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const params = new URLSearchParams(suggestForm).toString();
      const result = await apiGet(`/venues/suggest?${params}`);
      setSuggestion(result);
    } catch (err) {
      setError(err.message);
    }
  };

  const askAi = async (e) => {
    e.preventDefault();
    setAiError("");
    setAiLoading(true);
    setAiResult(null);
    try {
      const result = await apiPost("/venues/ai-suggest", {
        ...aiForm,
        expected_attendees: parseInt(aiForm.expected_attendees, 10),
      });
      setAiResult(result);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ fontWeight: 700, color: NAVY }}>{editingId ? "Edit Venue" : "Add a Venue"}</div>
            {editingId && (
              <button onClick={cancelEdit} style={{ background: "none", border: "none", cursor: "pointer", color: "#9490A8", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                <X size={13} /> Cancel
              </button>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#9490A8", marginBottom: 16 }}>The Venue Agent's inventory.</div>
          {error && <div style={{ fontSize: 12, color: "#C23A5B", background: "#FDE7EC", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{error}</div>}
          <form onSubmit={saveVenue} style={{ display: "grid", gap: 12 }}>
            <Field label="Venue Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Field label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Field label="Capacity" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} required />
            <Field label="Amenities" placeholder="Projector, Mic, AC" value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} />
            <button type="submit" style={{ background: PURPLE, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {editingId ? "Save Changes" : "Add Venue"}
            </button>
          </form>

          <div style={{ marginTop: 20, borderTop: "1px solid #F0EEF8", paddingTop: 16 }}>
            {venues === null ? (
              <div style={{ fontSize: 13, color: "#9490A8" }}>Loading…</div>
            ) : venues.length === 0 ? (
              <div style={{ fontSize: 13, color: "#B0ACC4" }}>No venues added yet.</div>
            ) : (
              venues.map((v) => (
                <div key={v.venue_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #F0EEF8", fontSize: 13 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: NAVY }}>{v.name}</div>
                    <div style={{ fontSize: 11, color: "#9490A8" }}>{v.location} · {v.amenities}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ color: PURPLE, fontWeight: 700 }}>{v.capacity} seats</div>
                    <button onClick={() => startEdit(v)} title="Edit" style={{ background: "none", border: "none", cursor: "pointer", color: "#8B87A0", padding: 4 }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => removeVenue(v.venue_id)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: "#F0678E", padding: 4 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
            Venue Optimization (rule-based)
          </div>
          <div style={{ fontSize: 12, color: "#9490A8", marginBottom: 16 }}>
            Plain SQL — finds the smallest available venue that fits your expected crowd. No AI involved.
          </div>
          {error && <div style={{ fontSize: 12, color: "#C23A5B", background: "#FDE7EC", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{error}</div>}
          <form onSubmit={findVenue} style={{ display: "grid", gap: 12 }}>
            <Field label="Expected Attendees" type="number" value={suggestForm.expected_attendees} onChange={(e) => setSuggestForm({ ...suggestForm, expected_attendees: e.target.value })} required />
            <Field label="Start Time" type="datetime-local" value={suggestForm.start_time} onChange={(e) => setSuggestForm({ ...suggestForm, start_time: e.target.value })} required />
            <Field label="End Time" type="datetime-local" value={suggestForm.end_time} onChange={(e) => setSuggestForm({ ...suggestForm, end_time: e.target.value })} required />
            <button type="submit" style={{ background: NAVY, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Suggest Best Venue
            </button>
          </form>

          {suggestion && (
            <div style={{ marginTop: 16 }}>
              {suggestion.best_match ? (
                <div style={{ background: "#E3FBF3", padding: "12px 14px", borderRadius: 10, marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#1E9C74" }}>
                    <CheckCircle2 size={14} /> Best match: {suggestion.best_match.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#1E9C74" }}>{suggestion.best_match.capacity} seats · {suggestion.best_match.location}</div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "#C23A5B", background: "#FDE7EC", padding: "10px 14px", borderRadius: 10 }}>
                  No available venue fits — add a bigger venue or pick another time slot.
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
          <Sparkles size={15} color={PURPLE} /> AI Venue Recommendation (Google Gemini)
        </div>
        <div style={{ fontSize: 12, color: "#9490A8", marginBottom: 16 }}>
          Real AI reasoning — weighs capacity, amenities, and session context together, and explains its choice.
        </div>
        {aiError && <div style={{ fontSize: 12, color: "#C23A5B", background: "#FDE7EC", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{aiError}</div>}
        <form onSubmit={askAi} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Session Title" placeholder="AI in Healthcare" value={aiForm.title} onChange={(e) => setAiForm({ ...aiForm, title: e.target.value })} />
          <Field label="Track" placeholder="AI Track" value={aiForm.track} onChange={(e) => setAiForm({ ...aiForm, track: e.target.value })} />
          <Field label="Expected Attendees" type="number" value={aiForm.expected_attendees} onChange={(e) => setAiForm({ ...aiForm, expected_attendees: e.target.value })} required />
          <Field label="Amenities Needed" placeholder="Projector, live captioning" value={aiForm.amenities_needed} onChange={(e) => setAiForm({ ...aiForm, amenities_needed: e.target.value })} />
          <Field label="Start Time" type="datetime-local" value={aiForm.start_time} onChange={(e) => setAiForm({ ...aiForm, start_time: e.target.value })} required />
          <Field label="End Time" type="datetime-local" value={aiForm.end_time} onChange={(e) => setAiForm({ ...aiForm, end_time: e.target.value })} required />
          <button
            type="submit"
            disabled={aiLoading}
            style={{
              gridColumn: "1 / -1", background: PURPLE, color: "#fff", border: "none", padding: "10px 16px",
              borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: aiLoading ? "not-allowed" : "pointer",
              opacity: aiLoading ? 0.7 : 1,
            }}
          >
            {aiLoading ? "Asking Gemini…" : "Ask AI to Recommend a Venue"}
          </button>
        </form>

        {aiResult && (
          <div style={{ marginTop: 16 }}>
            {aiResult.recommendation ? (
              <div style={{ background: "#EDE7FF", padding: "12px 14px", borderRadius: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: PURPLE }}>
                  <Sparkles size={14} /> AI recommends: {aiResult.recommendation.name}
                </div>
                <div style={{ fontSize: 11, color: "#6D4CF0", marginBottom: 8 }}>
                  {aiResult.recommendation.capacity} seats · {aiResult.recommendation.location} · {aiResult.recommendation.amenities}
                </div>
                <div style={{ fontSize: 12, color: "#4B4768", fontStyle: "italic" }}>"{aiResult.reasoning}"</div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#C23A5B", background: "#FDE7EC", padding: "10px 14px", borderRadius: 10 }}>
                {aiResult.reasoning || "No suitable venue found."}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------- Speaker Agent ----------------
function SpeakersTab() {
  const [speakers, setSpeakers] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", topic: "", bio: "" });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  // Real AI (Gemini) speaker matching — separate from the plain form above.
  const [aiForm, setAiForm] = useState({ title: "", track: "", topic_needed: "", start_time: "", end_time: "" });
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const load = () => apiGet("/speakers").then(setSpeakers).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  const startEdit = (s) => {
    setEditingId(s.speaker_id);
    setForm({ name: s.name, email: s.email || "", topic: s.topic || "", bio: s.bio || "" });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setForm({ name: "", email: "", topic: "", bio: "" });
  };

  const saveSpeaker = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (editingId) {
        await apiPut(`/speakers/${editingId}`, form);
      } else {
        await apiPost("/speakers", form);
      }
      cancelEdit();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeSpeaker = async (id) => {
    if (!window.confirm("Delete this speaker? This can't be undone.")) return;
    setError("");
    try {
      await apiDelete(`/speakers/${id}`);
      load();
    } catch (err) {
      setError(err.message); // e.g. "Can't delete a speaker who has sessions assigned."
    }
  };

  const askAi = async (e) => {
    e.preventDefault();
    setAiError("");
    setAiLoading(true);
    setAiResult(null);
    try {
      const result = await apiPost("/speakers/ai-suggest", aiForm);
      setAiResult(result);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ fontWeight: 700, color: NAVY }}>{editingId ? "Edit Speaker" : "Add a Speaker"}</div>
            {editingId && (
              <button onClick={cancelEdit} style={{ background: "none", border: "none", cursor: "pointer", color: "#9490A8", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                <X size={13} /> Cancel
              </button>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#9490A8", marginBottom: 16 }}>The Speaker Agent's roster.</div>
          {error && <div style={{ fontSize: 12, color: "#C23A5B", background: "#FDE7EC", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{error}</div>}
          <form onSubmit={saveSpeaker} style={{ display: "grid", gap: 12 }}>
            <Field label="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Field label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Field label="Topic / Expertise" placeholder="AI & ML" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
            <Field label="Short Bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            <button type="submit" style={{ background: PURPLE, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {editingId ? "Save Changes" : "Add Speaker"}
            </button>
          </form>
        </Card>

        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 12 }}>Speaker Roster</div>
          {speakers === null ? (
            <div style={{ fontSize: 13, color: "#9490A8" }}>Loading…</div>
          ) : speakers.length === 0 ? (
            <div style={{ fontSize: 13, color: "#B0ACC4" }}>No speakers added yet.</div>
          ) : (
            speakers.map((s) => (
              <div key={s.speaker_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 0", borderBottom: "1px solid #F0EEF8" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#EDE7FF", color: PURPLE, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>
                    {s.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: "#9490A8" }}>{s.topic || "No topic set"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={() => startEdit(s)} title="Edit" style={{ background: "none", border: "none", cursor: "pointer", color: "#8B87A0", padding: 4 }}>
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => removeSpeaker(s.speaker_id)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: "#F0678E", padding: 4 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
          <Sparkles size={15} color={PURPLE} /> AI Speaker Matching (Google Gemini)
        </div>
        <div style={{ fontSize: 12, color: "#9490A8", marginBottom: 16 }}>
          Real AI reasoning — matches session topic to speaker expertise among who's actually free, and explains its pick.
        </div>
        {aiError && <div style={{ fontSize: 12, color: "#C23A5B", background: "#FDE7EC", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{aiError}</div>}
        <form onSubmit={askAi} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Session Title" placeholder="AI in Healthcare" value={aiForm.title} onChange={(e) => setAiForm({ ...aiForm, title: e.target.value })} />
          <Field label="Track" placeholder="AI Track" value={aiForm.track} onChange={(e) => setAiForm({ ...aiForm, track: e.target.value })} />
          <Field label="Topic Needed" placeholder="Machine Learning" value={aiForm.topic_needed} onChange={(e) => setAiForm({ ...aiForm, topic_needed: e.target.value })} />
          <div />
          <Field label="Start Time" type="datetime-local" value={aiForm.start_time} onChange={(e) => setAiForm({ ...aiForm, start_time: e.target.value })} required />
          <Field label="End Time" type="datetime-local" value={aiForm.end_time} onChange={(e) => setAiForm({ ...aiForm, end_time: e.target.value })} required />
          <button
            type="submit"
            disabled={aiLoading}
            style={{
              gridColumn: "1 / -1", background: PURPLE, color: "#fff", border: "none", padding: "10px 16px",
              borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: aiLoading ? "not-allowed" : "pointer",
              opacity: aiLoading ? 0.7 : 1,
            }}
          >
            {aiLoading ? "Asking Gemini…" : "Ask AI to Recommend a Speaker"}
          </button>
        </form>

        {aiResult && (
          <div style={{ marginTop: 16 }}>
            {aiResult.recommendation ? (
              <div style={{ background: "#EDE7FF", padding: "12px 14px", borderRadius: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: PURPLE }}>
                  <Sparkles size={14} /> AI recommends: {aiResult.recommendation.name}
                </div>
                <div style={{ fontSize: 11, color: "#6D4CF0", marginBottom: 8 }}>{aiResult.recommendation.topic}</div>
                <div style={{ fontSize: 12, color: "#4B4768", fontStyle: "italic" }}>"{aiResult.reasoning}"</div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#C23A5B", background: "#FDE7EC", padding: "10px 14px", borderRadius: 10 }}>
                {aiResult.reasoning || "No available speaker found."}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------- Sessions (scheduling, using both agents) ----------------
function SessionsTab() {
  const [sessions, setSessions] = useState(null);
  const [venues, setVenues] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [form, setForm] = useState({ title: "", track: "", venue_id: "", speaker_id: "", start_time: "", end_time: "", expected_attendees: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = () => {
    apiGet("/sessions").then(setSessions).catch((err) => setError(err.message));
    apiGet("/venues").then(setVenues).catch(() => {});
    apiGet("/speakers").then(setSpeakers).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const addSession = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await apiPost("/sessions", {
        ...form,
        venue_id: form.venue_id || null,
        speaker_id: form.speaker_id || null,
        expected_attendees: form.expected_attendees ? parseInt(form.expected_attendees, 10) : null,
      });
      setSuccess("Session scheduled — no venue or speaker conflicts.");
      setForm({ title: "", track: "", venue_id: "", speaker_id: "", start_time: "", end_time: "", expected_attendees: "" });
      load();
    } catch (err) {
      setError(err.message); // e.g. "Venue is already booked for ... during this time."
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 20 }}>
      <Card>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 4 }}>Schedule a Session</div>
        <div style={{ fontSize: 12, color: "#9490A8", marginBottom: 16 }}>
          Automatically rejected if the venue or speaker is already booked for that time.
        </div>
        {error && <div style={{ fontSize: 12, color: "#C23A5B", background: "#FDE7EC", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{error}</div>}
        {success && <div style={{ fontSize: 12, color: "#1E9C74", background: "#E3FBF3", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{success}</div>}
        <form onSubmit={addSession} style={{ display: "grid", gap: 12 }}>
          <Field label="Session Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <Field label="Track" placeholder="AI Track" value={form.track} onChange={(e) => setForm({ ...form, track: e.target.value })} />
          <div>
            <label style={labelStyle}>Venue</label>
            <select style={inputStyle} value={form.venue_id} onChange={(e) => setForm({ ...form, venue_id: e.target.value })}>
              <option value="">Select a venue</option>
              {venues.map((v) => <option key={v.venue_id} value={v.venue_id}>{v.name} ({v.capacity} seats)</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Speaker</label>
            <select style={inputStyle} value={form.speaker_id} onChange={(e) => setForm({ ...form, speaker_id: e.target.value })}>
              <option value="">Select a speaker</option>
              {speakers.map((s) => <option key={s.speaker_id} value={s.speaker_id}>{s.name}</option>)}
            </select>
          </div>
          <Field label="Start Time" type="datetime-local" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
          <Field label="End Time" type="datetime-local" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
          <Field label="Expected Attendees" type="number" value={form.expected_attendees} onChange={(e) => setForm({ ...form, expected_attendees: e.target.value })} />
          <button type="submit" style={{ background: PURPLE, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Schedule Session
          </button>
        </form>
      </Card>

      <Card>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 12 }}>Full Schedule</div>
        {sessions === null ? (
          <div style={{ fontSize: 13, color: "#9490A8" }}>Loading…</div>
        ) : sessions.length === 0 ? (
          <div style={{ fontSize: 13, color: "#B0ACC4" }}>No sessions scheduled yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sessions.map((s) => (
              <div key={s.session_id} style={{ padding: "10px 12px", borderRadius: 10, background: "#F9F8FD" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{s.title}</div>
                <div style={{ fontSize: 11, color: "#9490A8", marginTop: 2 }}>
                  {s.track || "No track"} · {s.venue_name || "No venue"} · {s.speaker_name || "No speaker"}
                </div>
                <div style={{ fontSize: 11, color: PURPLE, marginTop: 2 }}>
                  {new Date(s.start_time).toLocaleString()} → {new Date(s.end_time).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------- Session Analytics ----------------
function SessionAnalyticsTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState([]);

  const [logForm, setLogForm] = useState({ session_id: "", registration_id: "", session_rating: "", speaker_rating: "", comments: "" });
  const [logError, setLogError] = useState("");
  const [logSuccess, setLogSuccess] = useState("");

  const load = () => {
    apiGet("/sessions/analytics").then(setData).catch((err) => setError(err.message));
    apiGet("/sessions").then(setSessions).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const recordAttendance = async (e) => {
    e.preventDefault();
    setLogError("");
    setLogSuccess("");
    if (!logForm.session_id || !logForm.registration_id) {
      setLogError("Session and registration ID are required to record attendance.");
      return;
    }
    try {
      await apiPost(`/sessions/${logForm.session_id}/attendance`, { registration_id: parseInt(logForm.registration_id, 10) });
      setLogSuccess("Attendance recorded.");
      load();
    } catch (err) {
      setLogError(err.message);
    }
  };

  const submitFeedback = async (e) => {
    e.preventDefault();
    setLogError("");
    setLogSuccess("");
    if (!logForm.session_id || !logForm.session_rating) {
      setLogError("Session and a session rating are required to submit feedback.");
      return;
    }
    try {
      await apiPost(`/sessions/${logForm.session_id}/feedback`, {
        registration_id: logForm.registration_id ? parseInt(logForm.registration_id, 10) : null,
        session_rating: parseInt(logForm.session_rating, 10),
        speaker_rating: logForm.speaker_rating ? parseInt(logForm.speaker_rating, 10) : null,
        comments: logForm.comments || null,
      });
      setLogSuccess("Feedback submitted.");
      setLogForm({ ...logForm, session_rating: "", speaker_rating: "", comments: "" });
      load();
    } catch (err) {
      setLogError(err.message);
    }
  };

  if (error) return <div style={{ fontSize: 13, color: "#C23A5B", background: "#FDE7EC", padding: "10px 14px", borderRadius: 10 }}>{error}</div>;
  if (!data) return <div style={{ fontSize: 13, color: "#9490A8" }}>Loading…</div>;

  const peakAttendanceData = (data.peak_attendance_times || []).map((h) => ({
    name: `${String(h.hour).padStart(2, "0")}:00`,
    value: parseInt(h.attendee_count, 10),
  }));
  const occupancyData = (data.venue_occupancy || [])
    .filter((v) => v.avg_occupancy_pct !== null)
    .map((v) => ({ name: v.venue, value: parseFloat(v.avg_occupancy_pct) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 16 }}>
        <StatBox label="Total Sessions" value={data.total_sessions} />
        <StatBox label="Upcoming" value={data.upcoming} />
        <StatBox label="Completed" value={data.completed} />
        <StatBox label="Avg. Session Rating" value={data.average_session_rating !== null ? `${data.average_session_rating} / 5` : "—"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
        <BreakdownCard title="By Track" rows={data.by_track} keyField="track" />
        <BreakdownCard title="By Venue" rows={data.by_venue} keyField="venue" />
        <BreakdownCard title="By Speaker" rows={data.by_speaker} keyField="speaker" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 4 }}>Most Popular Sessions</div>
          <div style={{ fontSize: 11, color: "#9490A8", marginBottom: 12 }}>Ranked by recorded attendance.</div>
          {!data.most_popular_sessions || data.most_popular_sessions.length === 0 ? (
            <div style={{ fontSize: 12, color: "#B0ACC4" }}>No attendance recorded yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.most_popular_sessions.map((s) => (
                <div key={s.session_id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F0EEF8" }}>
                  <div style={{ fontSize: 13, color: NAVY, fontWeight: 600 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: "#9490A8" }}>
                    {s.actual_attendees} attendee(s){s.attendance_rate_pct !== null ? ` · ${s.attendance_rate_pct}% of expected` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 4 }}>Speaker Feedback Score</div>
          <div style={{ fontSize: 11, color: "#9490A8", marginBottom: 12 }}>Average attendee rating of each speaker (1–5).</div>
          {!data.speaker_feedback_scores || data.speaker_feedback_scores.length === 0 ? (
            <div style={{ fontSize: 12, color: "#B0ACC4" }}>No feedback submitted yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.speaker_feedback_scores.map((f) => (
                <div key={f.speaker} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F0EEF8" }}>
                  <div style={{ fontSize: 13, color: NAVY, fontWeight: 600 }}>{f.speaker}</div>
                  <div style={{ fontSize: 12, color: PURPLE, fontWeight: 700 }}>{f.avg_speaker_rating} / 5 ({f.feedback_count})</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 10 }}>Peak Attendance Times</div>
          <div style={{ fontSize: 11, color: "#9490A8", marginBottom: 10 }}>Recorded attendance grouped by the hour sessions start.</div>
          {peakAttendanceData.length === 0 ? (
            <div style={{ fontSize: 12, color: "#B0ACC4" }}>No attendance recorded yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={peakAttendanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0EEF8" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9490A8" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9490A8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E3E0F1" }} />
                <Bar dataKey="value" fill={PURPLE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 10 }}>Room Occupancy by Venue</div>
          <div style={{ fontSize: 11, color: "#9490A8", marginBottom: 10 }}>Avg. % of each venue's capacity actually filled, based on recorded attendance.</div>
          {occupancyData.length === 0 ? (
            <div style={{ fontSize: 12, color: "#B0ACC4" }}>No attendance recorded yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={occupancyData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F0EEF8" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#9490A8" }} axisLine={false} tickLine={false} unit="%" />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "#4B4768" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E3E0F1" }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {occupancyData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 4 }}>Log Attendance &amp; Feedback</div>
        <div style={{ fontSize: 11, color: "#9490A8", marginBottom: 16 }}>
          Record a check-in or a post-session rating for a registered attendee — feeds the metrics above.
        </div>
        {logError && <div style={{ fontSize: 12, color: "#C23A5B", background: "#FDE7EC", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{logError}</div>}
        {logSuccess && <div style={{ fontSize: 12, color: "#1E9C74", background: "#E3FBF3", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{logSuccess}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Session</label>
            <select style={inputStyle} value={logForm.session_id} onChange={(e) => setLogForm({ ...logForm, session_id: e.target.value })}>
              <option value="">Select a session</option>
              {sessions.map((s) => <option key={s.session_id} value={s.session_id}>{s.title}</option>)}
            </select>
          </div>
          <Field label="Registration ID" type="number" value={logForm.registration_id} onChange={(e) => setLogForm({ ...logForm, registration_id: e.target.value })} />
          <Field label="Session Rating (1-5)" type="number" min="1" max="5" value={logForm.session_rating} onChange={(e) => setLogForm({ ...logForm, session_rating: e.target.value })} />
          <Field label="Speaker Rating (1-5)" type="number" min="1" max="5" value={logForm.speaker_rating} onChange={(e) => setLogForm({ ...logForm, speaker_rating: e.target.value })} />
        </div>
        <Field label="Comments (optional)" value={logForm.comments} onChange={(e) => setLogForm({ ...logForm, comments: e.target.value })} />
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={recordAttendance} style={{ background: NAVY, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Record Attendance
          </button>
          <button onClick={submitFeedback} style={{ background: PURPLE, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Submit Feedback
          </button>
        </div>
      </Card>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <Card style={{ flex: 1 }}>
      <div style={{ fontSize: 12, color: "#8B87A0" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: NAVY, marginTop: 4 }}>{value}</div>
    </Card>
  );
}

function BreakdownCard({ title, rows, keyField }) {
  if (!rows || rows.length === 0) {
    return (
      <Card>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#B0ACC4" }}>No data yet.</div>
      </Card>
    );
  }
  // Recharts needs numeric values, not the "12" (string) Postgres COUNT() returns.
  const chartData = rows.map((r) => ({ name: r[keyField], count: parseInt(r.count, 10) }));

  return (
    <Card>
      <div style={{ fontWeight: 700, color: NAVY, marginBottom: 10 }}>{title}</div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F0EEF8" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#9490A8" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "#4B4768" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E3E0F1" }} />
          <Bar dataKey="count" radius={[0, 6, 6, 0]}>
            {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
