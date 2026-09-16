import React, { useEffect, useState } from "react";
import { TrendingUp, Star, Users2, Clock, AlertCircle, Sparkles, RefreshCw } from "lucide-react";
import Card from "../components/Card";
import { PURPLE, NAVY } from "../theme";
import { apiGet } from "../api";

function InsightCard({ icon: Icon, title, text }) {
  return (
    <div style={{ display: "flex", gap: 14, padding: "16px 0", borderBottom: "1px solid #F0EEF8" }}>
      <div
        style={{
          width: 40, height: 40, borderRadius: 10, background: "#EDE7FF",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}
      >
        <Icon size={18} color={PURPLE} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 13, color: "#7A7690" }}>{text}</div>
      </div>
    </div>
  );
}

export default function AIInsightsPage() {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState("");

  // Real Gemini-generated insights — separate state because this is a
  // slower, on-demand AI call, not a plain database read like the rest
  // of the page.
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const loadAiInsights = () => {
    setAiLoading(true);
    setAiError("");
    apiGet("/ai/insights")
      .then((res) => setAiText(res.insights_text))
      .catch((err) => setAiError(err.message))
      .finally(() => setAiLoading(false));
  };

  useEffect(() => {
    Promise.all([apiGet("/dashboard"), apiGet("/analytics")])
      .then(([s, a]) => {
        setStats(s);
        setAnalytics(a);
      })
      .catch((err) => setError(err.message));
    loadAiInsights();
  }, []);

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ fontSize: 13, color: "#C23A5B", background: "#FDE7EC", padding: "10px 14px", borderRadius: 10 }}>
          Could not load insights: {error}.
        </div>
      </div>
    );
  }
  if (!stats || !analytics) {
    return <div style={{ padding: 24, fontSize: 13, color: "#9490A8" }}>Loading…</div>;
  }

  const insights = [];

  // Check-in rate
  if (stats.total_registrations > 0) {
    const rate = Math.round((stats.checked_in / stats.total_registrations) * 100);
    insights.push({
      icon: TrendingUp,
      title: "Check-in Rate",
      text: `${rate}% of registered attendees (${stats.checked_in} of ${stats.total_registrations}) have checked in so far.`,
    });
  }

  // Most popular ticket type
  const topTicket = [...(analytics.by_ticket_type || [])].sort((a, b) => b.count - a.count)[0];
  if (topTicket) {
    insights.push({
      icon: Star,
      title: "Most Popular Ticket Type",
      text: `"${topTicket.ticket_type}" is the most-selected ticket type, with ${topTicket.count} registration(s).`,
    });
  }

  // Top registration source
  const topSource = [...(analytics.by_source || [])].sort((a, b) => b.count - a.count)[0];
  if (topSource) {
    insights.push({
      icon: Users2,
      title: "Leading Registration Source",
      text: `Most attendees are registering via "${topSource.source}" (${topSource.count} registration(s)).`,
    });
  }

  // Busiest registration day
  const trend = analytics.trend || [];
  if (trend.length > 0) {
    const busiest = [...trend].sort((a, b) => b.value - a.value)[0];
    insights.push({
      icon: Clock,
      title: "Busiest Registration Day",
      text: `${busiest.day} had the most registrations (${busiest.value}) so far.`,
    });
  }

  // Pending check-ins flag
  if (stats.pending_checkin > 0) {
    insights.push({
      icon: AlertCircle,
      title: "Pending Check-ins",
      text: `${stats.pending_checkin} attendee(s) are registered but haven't checked in yet.`,
    });
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <Card style={{ maxWidth: 720 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: NAVY }}>
            <Sparkles size={15} color={PURPLE} /> AI-Generated Insights (Google Gemini)
          </div>
          <button
            onClick={loadAiInsights}
            disabled={aiLoading}
            style={{
              display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px solid #E3E0F1",
              color: PURPLE, padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
              cursor: aiLoading ? "not-allowed" : "pointer",
            }}
          >
            <RefreshCw size={12} className={aiLoading ? "spin" : ""} /> {aiLoading ? "Thinking…" : "Regenerate"}
          </button>
        </div>
        <div style={{ fontSize: 11, color: "#9490A8", marginBottom: 12 }}>
          Actually generated by an LLM reading your live data — not a template.
        </div>

        {aiError && (
          <div style={{ fontSize: 12, color: "#C23A5B", background: "#FDE7EC", padding: "10px 14px", borderRadius: 10 }}>
            {aiError}
          </div>
        )}
        {!aiError && aiLoading && !aiText && (
          <div style={{ fontSize: 13, color: "#9490A8" }}>Asking Gemini to look at your data…</div>
        )}
        {!aiError && aiText && (
          <div style={{ fontSize: 13, color: "#3B3760", whiteSpace: "pre-line", lineHeight: 1.6 }}>{aiText}</div>
        )}
      </Card>

      <Card style={{ maxWidth: 720 }}>
        <div style={{ fontSize: 12, color: "#9490A8", marginBottom: 4 }}>
          Computed directly from your real registration data with simple rules — not AI-generated (see the
          section above for real AI output).
        </div>
        {insights.length === 0 ? (
          <div style={{ padding: "30px 0", textAlign: "center", fontSize: 13, color: "#B0ACC4" }}>
            No registrations yet — insights will appear here once attendees start registering.
          </div>
        ) : (
          insights.map((ins, i) => <InsightCard key={i} {...ins} />)
        )}
      </Card>
    </div>
  );
}
