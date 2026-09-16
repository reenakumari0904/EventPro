import React, { useEffect, useRef, useState } from "react";
import { Bell, Settings, Download, Menu } from "lucide-react";
import { PURPLE, NAVY } from "../theme";
import NotificationsPanel from "./NotificationsPanel";
import { getNotifications, saveNotifications } from "../utils/localSettings";

export default function Topbar({ title, subtitle, onExport, onNavigate, onToggleSidebar }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState(() => getNotifications());
  const notifRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const persist = (next) => {
    setNotifications(next);
    saveNotifications(next);
  };

  const markRead = (id) => {
    persist(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };
  const markAllRead = () => {
    persist(notifications.map((n) => ({ ...n, read: true })));
  };
  const clearAll = () => {
    persist([]);
  };

  return (
    <div
      className="topbar"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "18px 28px",
        background: "#fff",
        borderBottom: "1px solid #ECEAF4",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <button
          className="hamburger-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle menu"
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}
        >
          <Menu size={20} color={NAVY} />
        </button>
        <div style={{ minWidth: 0 }}>
          <div className="topbar-title" style={{ fontSize: 20, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {title}
          </div>
          {subtitle && (
            <div className="topbar-subtitle" style={{ fontSize: 12, color: "#9490A8", marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      <div className="topbar-actions" style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        {onExport && (
          <button
            onClick={onExport}
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
              whiteSpace: "nowrap",
            }}
          >
            <Download size={14} /> <span className="export-btn-label">Export Report</span>
          </button>
        )}

        <div ref={notifRef} style={{ position: "relative" }}>
          <button
            onClick={() => setNotifOpen((o) => !o)}
            aria-label="Notifications"
            style={{ position: "relative", background: "transparent", border: "none", cursor: "pointer", padding: 4, display: "flex" }}
          >
            <Bell size={18} color={notifOpen ? PURPLE : "#8B87A0"} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  minWidth: 15,
                  height: 15,
                  borderRadius: "50%",
                  background: "#E14C6C",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 3px",
                  border: "2px solid #fff",
                }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <NotificationsPanel
              notifications={notifications}
              onMarkRead={markRead}
              onMarkAllRead={markAllRead}
              onClear={clearAll}
            />
          )}
        </div>

        <button
          onClick={() => onNavigate?.("settings")}
          aria-label="Settings"
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, display: "flex" }}
        >
          <Settings size={18} color="#8B87A0" />
        </button>

        <div className="admin-info" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: PURPLE,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            A
          </div>
          <div className="admin-info-text" style={{ fontSize: 12, lineHeight: 1.3 }}>
            <div style={{ fontWeight: 600, color: NAVY }}>Admin</div>
            <div style={{ color: "#9490A8" }}>Event Organizer</div>
          </div>
        </div>
      </div>
    </div>
  );
}
