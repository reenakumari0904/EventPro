import React, { useEffect, useState, useCallback } from "react";
import { QrCode, CheckCircle2 } from "lucide-react";
import Card from "../components/Card";
import QrScanner from "../components/QrScanner";
import { PURPLE, NAVY } from "../theme";
import { apiGet, apiPost } from "../api";

// The backend encodes each QR as "REG-<registration_id>" (see
// registration.controller.js). This extracts that id back out.
function parseRegistrationId(scannedText) {
  const match = /^REG-(\d+)$/.exec(scannedText.trim());
  return match ? parseInt(match[1], 10) : null;
}

export default function CheckinPage() {
  const [attendees, setAttendees] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [checkingIn, setCheckingIn] = useState(null);
  const [scanMessage, setScanMessage] = useState(null); // { type: 'success'|'error', text }
  const lastScannedRef = React.useRef(null);

  const load = useCallback(() => {
    apiGet("/attendees")
      .then((data) => {
        setAttendees(data);
        setSelected((prev) => prev ?? (data.find((a) => !a.checkin_time) || data[0])?.registration_id ?? null);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  const checkIn = useCallback(
    async (registration_id, { fromScan = false } = {}) => {
      setCheckingIn(registration_id);
      try {
        await apiPost("/checkin", { registration_id, gate: "Main Gate", device: fromScan ? "QR Scanner" : "Web Dashboard" });
        const attendee = attendees?.find((a) => a.registration_id === registration_id);
        if (fromScan) {
          setScanMessage({ type: "success", text: `Checked in: ${attendee?.name || "Registration #" + registration_id}` });
        }
        load();
      } catch (err) {
        if (fromScan) setScanMessage({ type: "error", text: err.message });
        else setError(err.message);
      } finally {
        setCheckingIn(null);
      }
    },
    [attendees, load]
  );

  // Called by the camera scanner every time it decodes a QR code.
  const handleScan = useCallback(
    (decodedText) => {
      // Debounce — the camera fires the callback continuously while the
      // code stays in frame, so ignore repeats of the same code.
      if (lastScannedRef.current === decodedText) return;
      lastScannedRef.current = decodedText;
      setTimeout(() => {
        if (lastScannedRef.current === decodedText) lastScannedRef.current = null;
      }, 3000);

      const registrationId = parseRegistrationId(decodedText);
      if (!registrationId) {
        setScanMessage({ type: "error", text: "That QR code isn't a valid EventPro registration code." });
        return;
      }
      const attendee = attendees?.find((a) => a.registration_id === registrationId);
      if (!attendee) {
        setScanMessage({ type: "error", text: `No registration found for #${registrationId}.` });
        return;
      }
      if (attendee.checkin_time) {
        setScanMessage({ type: "error", text: `${attendee.name} is already checked in.` });
        return;
      }
      checkIn(registrationId, { fromScan: true });
    },
    [attendees, checkIn]
  );

  const selectedAttendee = attendees?.find((a) => a.registration_id === selected);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>Check-in Tracking</div>
        <div style={{ fontSize: 12, color: "#9490A8" }}>
          Scan an attendee's real QR code with your camera to check them in automatically, or use the
          manual list on the right.
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 13, color: "#C23A5B", background: "#FDE7EC", padding: "10px 14px", borderRadius: 10, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 20 }}>
        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 12 }}>Camera Scanner</div>
          <QrScanner onScan={handleScan} />

          {scanMessage && (
            <div
              style={{
                marginTop: 12, padding: "10px 14px", borderRadius: 10, fontSize: 13,
                background: scanMessage.type === "success" ? "#E3FBF3" : "#FDE7EC",
                color: scanMessage.type === "success" ? "#1E9C74" : "#C23A5B",
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              {scanMessage.type === "success" && <CheckCircle2 size={16} />}
              {scanMessage.text}
            </div>
          )}

          <div style={{ marginTop: 20, borderTop: "1px solid #F0EEF8", paddingTop: 16 }}>
            <div style={{ fontSize: 12, color: "#9490A8", marginBottom: 10 }}>Selected attendee's QR code</div>
            {selectedAttendee?.qr_code ? (
              <div style={{ textAlign: "center" }}>
                <img src={selectedAttendee.qr_code} alt="Attendee QR code" style={{ width: 130, height: 130 }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, marginTop: 8 }}>{selectedAttendee.name}</div>
                <div style={{ fontSize: 10, color: "#9490A8" }}>Registration #{selectedAttendee.registration_id}</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#B0ACC4" }}>
                <QrCode size={60} />
                <div style={{ fontSize: 12, marginTop: 8 }}>Select an attendee from the list</div>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 12 }}>All Attendees (manual check-in)</div>
          {attendees === null ? (
            <div style={{ fontSize: 13, color: "#9490A8" }}>Loading…</div>
          ) : attendees.length === 0 ? (
            <div style={{ fontSize: 13, color: "#B0ACC4", textAlign: "center", padding: "30px 0" }}>
              No attendees registered yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 560, overflowY: "auto" }}>
              {attendees.map((a) => {
                const isCheckedIn = !!a.checkin_time;
                return (
                  <div
                    key={a.registration_id}
                    onClick={() => setSelected(a.registration_id)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 12px", borderRadius: 12, cursor: "pointer",
                      background: selected === a.registration_id ? "#F5F2FF" : "transparent",
                      border: selected === a.registration_id ? `1px solid ${PURPLE}` : "1px solid transparent",
                    }}
                  >
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

                    {isCheckedIn ? (
                      <span
                        style={{
                          display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
                          color: "#2FC59B", background: "#E3FBF3", padding: "4px 10px", borderRadius: 999,
                        }}
                      >
                        <CheckCircle2 size={12} /> Checked-In
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          checkIn(a.registration_id);
                        }}
                        disabled={checkingIn === a.registration_id}
                        style={{
                          background: PURPLE, color: "#fff", border: "none", padding: "6px 14px",
                          borderRadius: 999, fontSize: 12, fontWeight: 600,
                          cursor: checkingIn === a.registration_id ? "not-allowed" : "pointer",
                          opacity: checkingIn === a.registration_id ? 0.6 : 1,
                        }}
                      >
                        {checkingIn === a.registration_id ? "Checking in…" : "Check In"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}