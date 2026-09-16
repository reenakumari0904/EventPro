import React from "react";
import { NAVY } from "../theme";

export default function Placeholder({ title }) {
  return (
    <div style={{ padding: 60, textAlign: "center", color: "#9490A8" }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 8 }}>{title}</div>
      Coming soon in a future milestone.
    </div>
  );
}
