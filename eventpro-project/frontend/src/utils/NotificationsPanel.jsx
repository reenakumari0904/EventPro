import React from "react";
import { ShieldAlert, Users2, Mic2, Sparkles, Check, Trash2 } from "lucide-react";
import { PURPLE, NAVY } from "../theme";

const ICONS = {
  incident: ShieldAlert,
  crowd: Users2,
  speaker: Mic2,
  system: Sparkles,
};

function timeAgo(ts) {
  const diffMs = Date.now() - ts;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default function NotificationsPanel({ notifications, onMarkRead, onMarkAllRead, onClear }) {
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div
      className="notif-panel"
      style={{
        position: "absolute",
        top: 44,
        right: 0,
        width: 340,
        maxWidth: "calc(100vw - 32px)",
        background: "#fff",
        borderRadius: 14,
        boxShadow: "0 12px 32px rgba(27,21,51,0.18)",
        border: "1px solid #ECEAF4",
        zIndex: 50,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid #F0EEF8",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>Notifications</div>
        {hasUnread && (
          <button
            onClick={onMarkAllRead}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "transparent",
              border: "none",
              color: PURPLE,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              padding: 0,
            }}
          >
            <Check size={13} /> Mark all read
          </button>
        )}
      </div>

      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {notifications.length === 0 ? (
          <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: "#9490A8" }}>
            You're all caught up.
          </div>
        ) : (
          notifications.map((n) => {
            const Icon = ICONS[n.type] || Sparkles;
            return (
              <button
                key={n.id}
                onClick={() => onMarkRead(n.id)}
                style={{
                  display: "flex",
                  gap: 10,
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 16px",
                  border: "none",
                  borderBottom: "1px solid #F5F4FA",
                  background: n.read ? "#fff" : "#F8F6FF",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    background: "#EDE7FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={15} color={PURPLE} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{n.title}</div>
                    {!n.read && (
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: PURPLE, flexShrink: 0 }} />
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#7A7690", marginTop: 2, lineHeight: 1.4 }}>{n.message}</div>
                  <div style={{ fontSize: 11, color: "#B0ACC2", marginTop: 4 }}>{timeAgo(n.time)}</div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {notifications.length > 0 && (
        <div style={{ padding: "10px 16px", borderTop: "1px solid #F0EEF8" }}>
          <button
            onClick={onClear}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              border: "none",
              color: "#9490A8",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              padding: 0,
            }}
          >
            <Trash2 size={13} /> Clear all
          </button>
        </div>
      )}
    </div>
  );
}
