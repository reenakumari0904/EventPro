import React from "react";
import { Sparkles, LogOut, X } from "lucide-react";
import { navItems } from "../pageConfig";
import { PURPLE, NAVY } from "../theme";

export default function Sidebar({ active, setActive, onLogout, open, onClose }) {
  const handleSelect = (key) => {
    setActive(key);
    onClose?.();
  };

  return (
    <div
      className={`sidebar${open ? " open" : ""}`}
      style={{
        width: 220,
        background: NAVY,
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        padding: "20px 14px",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 19, fontWeight: 700 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: PURPLE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Sparkles size={16} />
          </div>
          EventPro
        </div>
        <button
          className="sidebar-close-btn"
          onClick={onClose}
          aria-label="Close menu"
          style={{ display: "none", background: "transparent", border: "none", color: "#B4AFC9", cursor: "pointer" }}
        >
          <X size={18} />
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, overflowY: "auto" }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => handleSelect(item.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                background: isActive ? PURPLE : "transparent",
                color: isActive ? "#fff" : "#B4AFC9",
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                transition: "background 0.15s",
              }}
            >
              <Icon size={17} />
              {item.label}
            </button>
          );
        })}
      </div>
      <button
        onClick={onLogout}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "transparent",
          border: "none",
          color: "#B4AFC9",
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        <LogOut size={17} /> Logout
      </button>
    </div>
  );
}
