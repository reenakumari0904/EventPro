import React, { useState } from "react";
import { Plug, Check } from "lucide-react";
import Card from "../components/Card";
import { PURPLE, NAVY } from "../theme";
import { getIntegrations, saveIntegrations } from "../utils/localSettings";

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState(getIntegrations);

  const connectedCount = integrations.filter((i) => i.connected).length;

  const toggle = (id) => {
    const next = integrations.map((i) => (i.id === id ? { ...i, connected: !i.connected } : i));
    setIntegrations(next);
    saveIntegrations(next);
  };

  return (
    <div className="page-padding">
      <Card style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#EDE7FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Plug size={18} color={PURPLE} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>Connected Apps</div>
            <div style={{ fontSize: 12, color: "#9490A8" }}>{connectedCount} of {integrations.length} integrations connected</div>
          </div>
        </div>
      </Card>

      <div className="responsive-grid-3">
        {integrations.map((item) => (
          <Card key={item.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{item.name}</div>
                <div
                  style={{
                    display: "inline-block",
                    marginTop: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.3,
                    textTransform: "uppercase",
                    color: PURPLE,
                    background: "#EDE7FF",
                    padding: "2px 8px",
                    borderRadius: 999,
                  }}
                >
                  {item.category}
                </div>
              </div>
              {item.connected && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#2E9E6B",
                    flexShrink: 0,
                  }}
                >
                  <Check size={13} /> Connected
                </div>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: "#7A7690", lineHeight: 1.5, flex: 1 }}>{item.description}</div>
            <button
              onClick={() => toggle(item.id)}
              style={{
                marginTop: 4,
                padding: "9px 14px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                border: item.connected ? "1px solid #E4E1F0" : "none",
                background: item.connected ? "#fff" : PURPLE,
                color: item.connected ? "#6A6580" : "#fff",
              }}
            >
              {item.connected ? "Disconnect" : "Connect"}
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
