import React from "react";
import { NAVY } from "../theme";

export default function StatCard({ label, value, delta, up, icon: Icon, iconBg, iconColor }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: "18px 20px",
        flex: 1,
        minWidth: 150,
        boxShadow: "0 2px 10px rgba(27,21,51,0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "#8B87A0" }}>{label}</span>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={16} color={iconColor} />
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: NAVY, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 12, marginTop: 4, color: up ? "#2FC59B" : "#F0678E", fontWeight: 600 }}>
        {up ? "▲" : "▼"} {delta} <span style={{ color: "#B0ACC4", fontWeight: 400 }}>from last week</span>
      </div>
    </div>
  );
}
