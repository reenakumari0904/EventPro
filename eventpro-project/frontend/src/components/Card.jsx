import React from "react";

export default function Card({ children, style }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 2px 10px rgba(27,21,51,0.04)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
