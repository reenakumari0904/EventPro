import React, { useState } from "react";
import { Building2, BellRing, ShieldCheck, RotateCcw, Check } from "lucide-react";
import Card from "../components/Card";
import { PURPLE, NAVY } from "../theme";
import {
  getGeneralSettings,
  saveGeneralSettings,
  DEFAULT_GENERAL,
  getNotifPrefs,
  saveNotifPrefs,
  DEFAULT_NOTIF_PREFS,
  getSecuritySettings,
  saveSecuritySettings,
  DEFAULT_SECURITY,
} from "../utils/localSettings";

const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Europe/London", "America/New_York", "America/Los_Angeles", "Australia/Sydney"];
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "AUD"];
const SESSION_TIMEOUTS = [15, 30, 60, 120, 240];

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EDE7FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={17} color={PURPLE} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: "#9490A8" }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function SavedBadge({ show }) {
  if (!show) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#2E9E6B", fontSize: 12, fontWeight: 600 }}>
      <Check size={13} /> Saved
    </span>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #E4E1F0",
  fontSize: 13,
  color: NAVY,
  background: "#FBFAFF",
  outline: "none",
};

const labelStyle = { fontSize: 12, fontWeight: 600, color: "#6A6580", marginBottom: 6, display: "block" };

function Field({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="slider" />
    </label>
  );
}

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "12px 0", borderBottom: "1px solid #F0EEF8" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: "#9490A8", marginTop: 2 }}>{description}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export default function SettingsPage() {
  const [general, setGeneral] = useState(getGeneralSettings);
  const [generalSaved, setGeneralSaved] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState(getNotifPrefs);

  const [security, setSecurity] = useState(getSecuritySettings);
  const [securitySaved, setSecuritySaved] = useState(false);

  const flash = (setter) => {
    setter(true);
    setTimeout(() => setter(false), 1800);
  };

  const handleGeneralSave = (e) => {
    e.preventDefault();
    saveGeneralSettings(general);
    flash(setGeneralSaved);
  };

  const updateNotifPref = (key, value) => {
    const next = { ...notifPrefs, [key]: value };
    setNotifPrefs(next);
    saveNotifPrefs(next);
  };

  const handleSecuritySave = (e) => {
    e.preventDefault();
    saveSecuritySettings(security);
    flash(setSecuritySaved);
  };

  const handleResetAll = () => {
    setGeneral(DEFAULT_GENERAL);
    saveGeneralSettings(DEFAULT_GENERAL);
    setNotifPrefs(DEFAULT_NOTIF_PREFS);
    saveNotifPrefs(DEFAULT_NOTIF_PREFS);
    setSecurity(DEFAULT_SECURITY);
    saveSecuritySettings(DEFAULT_SECURITY);
  };

  return (
    <div className="page-padding responsive-grid-2" style={{ alignItems: "start" }}>
      <Card>
        <SectionHeader icon={Building2} title="Organization Profile" subtitle="Shown across dashboards and exported reports" />
        <form onSubmit={handleGeneralSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="settings-form-row">
            <Field label="Organization name">
              <input
                style={inputStyle}
                value={general.orgName}
                onChange={(e) => setGeneral({ ...general, orgName: e.target.value })}
              />
            </Field>
            <Field label="Admin email">
              <input
                type="email"
                style={inputStyle}
                value={general.adminEmail}
                onChange={(e) => setGeneral({ ...general, adminEmail: e.target.value })}
              />
            </Field>
          </div>
          <div className="settings-form-row">
            <Field label="Timezone">
              <select style={inputStyle} value={general.timezone} onChange={(e) => setGeneral({ ...general, timezone: e.target.value })}>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </Field>
            <Field label="Currency">
              <select style={inputStyle} value={general.currency} onChange={(e) => setGeneral({ ...general, currency: e.target.value })}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <button
              type="submit"
              style={{ background: PURPLE, color: "#fff", border: "none", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Save changes
            </button>
            <SavedBadge show={generalSaved} />
          </div>
        </form>
      </Card>

      <Card>
        <SectionHeader icon={BellRing} title="Notification Preferences" subtitle="Choose what triggers an alert (changes save instantly)" />
        <div>
          <ToggleRow
            label="Email alerts"
            description="General account and event notifications by email"
            checked={notifPrefs.emailAlerts}
            onChange={(v) => updateNotifPref("emailAlerts", v)}
          />
          <ToggleRow
            label="SMS alerts"
            description="Time-critical alerts sent by text message"
            checked={notifPrefs.smsAlerts}
            onChange={(v) => updateNotifPref("smsAlerts", v)}
          />
          <ToggleRow
            label="High crowd density alerts"
            description="Notify when a venue/hall nears capacity"
            checked={notifPrefs.highCrowdAlerts}
            onChange={(v) => updateNotifPref("highCrowdAlerts", v)}
          />
          <ToggleRow
            label="Speaker cancellations"
            description="Notify when a speaker cancels a session"
            checked={notifPrefs.speakerCancellations}
            onChange={(v) => updateNotifPref("speakerCancellations", v)}
          />
          <ToggleRow
            label="Sponsor incidents"
            description="Notify when an incident is logged for a sponsor"
            checked={notifPrefs.sponsorIncidents}
            onChange={(v) => updateNotifPref("sponsorIncidents", v)}
          />
          <ToggleRow
            label="Weekly summary email"
            description="A digest of analytics and activity every week"
            checked={notifPrefs.weeklySummary}
            onChange={(v) => updateNotifPref("weeklySummary", v)}
          />
        </div>
      </Card>

      <Card>
        <SectionHeader icon={ShieldCheck} title="Security" subtitle="Session and login protections for this admin account" />
        <form onSubmit={handleSecuritySave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Session timeout">
            <select
              style={inputStyle}
              value={security.sessionTimeoutMinutes}
              onChange={(e) => setSecurity({ ...security, sessionTimeoutMinutes: Number(e.target.value) })}
            >
              {SESSION_TIMEOUTS.map((m) => (
                <option key={m} value={m}>{m} minutes</option>
              ))}
            </select>
          </Field>
          <ToggleRow
            label="Two-factor authentication"
            description="Require a one-time code at login, in addition to your password"
            checked={security.twoFactorEnabled}
            onChange={(v) => setSecurity({ ...security, twoFactorEnabled: v })}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <button
              type="submit"
              style={{ background: PURPLE, color: "#fff", border: "none", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Save changes
            </button>
            <SavedBadge show={securitySaved} />
          </div>
        </form>
      </Card>

      <Card>
        <SectionHeader icon={RotateCcw} title="Reset" subtitle="Restore every setting on this page to its default value" />
        <button
          onClick={handleResetAll}
          style={{ background: "#fff", color: "#C23A5B", border: "1px solid #F1C4CE", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          Reset all settings
        </button>
      </Card>
    </div>
  );
}
