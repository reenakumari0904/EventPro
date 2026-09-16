import React, { useState, useEffect, useCallback } from "react";
import { Search, Download, XCircle } from "lucide-react";
import Card from "../components/Card";
import { PURPLE, NAVY } from "../theme";
import { apiGet, apiPut } from "../api";

export default function AttendeesPage() {
  const [filter, setFilter] = useState("All");
  const [q, setQ] = useState("");
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(null); // registration_id in progress
  const filters = ["All", "Checked-In", "Not Checked-In", "VIP", "Student", "Cancelled"];

  const load = useCallback(() => {
    apiGet("/attendees")
      .then((data) => {
        // Map backend field names (registration_id, ticket_type, checkin_time...)
        // to the shape this page's UI expects.
        const mapped = data.map((r) => ({
          registration_id: r.registration_id,
          name: r.name,
          email: r.email,
          ticket: r.ticket_type,
          source: r.source,
          regStatus: r.status, // Registered | Confirmed | Cancelled | Waitlisted
          checkinStatus: r.checkin_time ? "Checked-In" : "Not Checked-In",
          time: r.checkin_time ? new Date(r.checkin_time).toLocaleString() : "-",
        }));
        setAttendees(mapped);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const cancelRegistration = async (registration_id) => {
    if (!window.confirm("Cancel this attendee's registration? This can be reversed later by an admin if needed.")) {
      return;
    }
    setCancelling(registration_id);
    try {
      await apiPut("/registration/status", { registration_id, status: "Cancelled" });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(null);
    }
  };

  const rows = attendees.filter((a) => {
    const matchesFilter =
      filter === "All" ||
      (filter === "Checked-In" && a.checkinStatus === "Checked-In") ||
      (filter === "Not Checked-In" && a.checkinStatus === "Not Checked-In") ||
      (filter === "Cancelled" && a.regStatus === "Cancelled") ||
      a.ticket === filter;
    const matchesQ = (a.name + a.email).toLowerCase().includes(q.toLowerCase());
    return matchesFilter && matchesQ;
  });

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: NAVY }}>Attendees</div>
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: PURPLE,
              color: "#fff",
              border: "none",
              padding: "9px 16px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Download size={14} /> Export
          </button>
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #E3E0F1", borderRadius: 10, padding: "8px 12px", flex: 1, minWidth: 200 }}>
            <Search size={14} color="#9490A8" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search attendees..."
              style={{ border: "none", outline: "none", fontSize: 13, flex: 1 }}
            />
          </div>
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                border: "none",
                borderRadius: 999,
                padding: "8px 14px",
                fontSize: 12,
                cursor: "pointer",
                background: filter === f ? PURPLE : "#F1EFFB",
                color: filter === f ? "#fff" : "#4B4768",
                fontWeight: 600,
              }}
            >
              {f}
            </button>
          ))}
        </div>
        {loading && <div style={{ fontSize: 13, color: "#9490A8", padding: "12px 0" }}>Loading attendees…</div>}
        {error && (
          <div style={{ fontSize: 13, color: "#C23A5B", background: "#FDE7EC", padding: "10px 14px", borderRadius: 10, marginBottom: 12 }}>
            {error}
          </div>
        )}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#9490A8", fontSize: 12 }}>
              <th style={{ padding: "8px 0" }}>#</th>
              <th>Name</th>
              <th>Email</th>
              <th>Ticket Type</th>
              <th>Source</th>
              <th>Registration Status</th>
              <th>Check-in Status</th>
              <th>Check-in Time</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a, i) => {
              const isCancelled = a.regStatus === "Cancelled";
              return (
                <tr key={a.registration_id} style={{ borderTop: "1px solid #F0EEF8", opacity: isCancelled ? 0.55 : 1 }}>
                  <td style={{ padding: "12px 0", color: "#9490A8" }}>{i + 1}</td>
                  <td style={{ fontWeight: 600, color: NAVY }}>{a.name}</td>
                  <td style={{ color: "#8B87A0" }}>{a.email}</td>
                  <td>{a.ticket}</td>
                  <td>{a.source}</td>
                  <td>
                    <span
                      style={{
                        fontSize: 11, fontWeight: 600,
                        color: isCancelled ? "#C23A5B" : "#4B4768",
                        background: isCancelled ? "#FDE7EC" : "#F1EFFB",
                        padding: "3px 10px", borderRadius: 999,
                      }}
                    >
                      {a.regStatus}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: a.checkinStatus === "Checked-In" ? "#2FC59B" : "#F0678E",
                        background: a.checkinStatus === "Checked-In" ? "#E3FBF3" : "#FDE7EC",
                        padding: "3px 10px",
                        borderRadius: 999,
                      }}
                    >
                      {a.checkinStatus}
                    </span>
                  </td>
                  <td style={{ color: "#8B87A0" }}>{a.time}</td>
                  <td>
                    {!isCancelled && (
                      <button
                        onClick={() => cancelRegistration(a.registration_id)}
                        disabled={cancelling === a.registration_id}
                        title="Cancel this registration"
                        style={{
                          display: "flex", alignItems: "center", gap: 4, background: "none",
                          border: "1px solid #F0678E", color: "#F0678E", padding: "5px 10px",
                          borderRadius: 999, fontSize: 11, fontWeight: 600,
                          cursor: cancelling === a.registration_id ? "not-allowed" : "pointer",
                          opacity: cancelling === a.registration_id ? 0.6 : 1,
                        }}
                      >
                        <XCircle size={12} />
                        {cancelling === a.registration_id ? "Cancelling…" : "Cancel"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}