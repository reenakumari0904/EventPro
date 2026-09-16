import React from "react";
import { Sparkles } from "lucide-react";
import RegistrationAgentPage from "./pages/RegistrationAgentPage";
import { PURPLE, NAVY, BG } from "./theme";

// Rendered when someone opens the shared registration link
export default function PublicRegisterPage() {
  const params = new URLSearchParams(window.location.search);
  const eventId = parseInt(params.get("event") || "1", 10);

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "20px 24px", fontSize: 18, fontWeight: 700, color: NAVY }}>
        <div
          style={{
            width: 30, height: 30, borderRadius: 8, background: PURPLE,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Sparkles size={16} color="#fff" />
        </div>
        EventPro
      </div>
      <RegistrationAgentPage eventId={eventId} standalone />
    </div>
  );
}