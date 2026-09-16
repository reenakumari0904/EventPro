import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { NAVY } from "../theme";

export default function Donut({ data, total, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <div style={{ width: 130, height: 130, position: "relative" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={42} outerRadius={62} paddingAngle={2} stroke="none">
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>{total}</div>
          <div style={{ fontSize: 11, color: "#9490A8" }}>{label}</div>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: d.color, display: "inline-block" }} />
              <span style={{ color: "#4B4768" }}>{d.name}</span>
            </div>
            <div style={{ color: NAVY, fontWeight: 600 }}>
              {d.pct}% <span style={{ color: "#9490A8", fontWeight: 400 }}>({d.value})</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
