// Client-side persistence for Settings / Notifications / Integrations.
// The backend doesn't expose endpoints for these yet, so we persist to
// localStorage — this keeps the tabs fully functional (values survive
// refresh/login) without requiring backend changes. If/when real
// endpoints exist, swap the read()/write() calls below for apiGet/apiPut.

const KEYS = {
  general: "eventpro_settings_general",
  notifPrefs: "eventpro_settings_notif_prefs",
  security: "eventpro_settings_security",
  integrations: "eventpro_integrations",
  notifications: "eventpro_notifications",
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — fail silently,
    // the UI still works for the current session.
  }
}

export const DEFAULT_GENERAL = {
  orgName: "EventPro Organization",
  adminEmail: "admin@eventpro.io",
  timezone: "Asia/Kolkata",
  currency: "INR",
};

export const DEFAULT_NOTIF_PREFS = {
  emailAlerts: true,
  smsAlerts: false,
  highCrowdAlerts: true,
  speakerCancellations: true,
  sponsorIncidents: true,
  weeklySummary: true,
};

export const DEFAULT_SECURITY = {
  sessionTimeoutMinutes: 60,
  twoFactorEnabled: false,
};

export const DEFAULT_INTEGRATIONS = [
  { id: "google_calendar", name: "Google Calendar", category: "Scheduling", description: "Sync sessions and speaker schedules to Google Calendar.", connected: false },
  { id: "slack", name: "Slack", category: "Communication", description: "Send workflow and incident alerts to a Slack channel.", connected: true },
  { id: "zoom", name: "Zoom", category: "Virtual Events", description: "Auto-create Zoom meetings for virtual and hybrid sessions.", connected: false },
  { id: "mailchimp", name: "Mailchimp", category: "Marketing", description: "Sync attendee lists to Mailchimp audiences.", connected: false },
  { id: "stripe", name: "Stripe", category: "Payments", description: "Process paid ticket registrations and refunds.", connected: true },
  { id: "sendgrid", name: "SendGrid", category: "Email", description: "Deliver QR check-in and reminder emails.", connected: true },
  { id: "twilio", name: "Twilio", category: "Communication", description: "Send SMS alerts for check-in and incidents.", connected: false },
  { id: "salesforce", name: "Salesforce", category: "CRM", description: "Push sponsor and lead data into Salesforce.", connected: false },
];

function seedNotifications() {
  return [
    { id: "n1", type: "incident", title: "Sponsor incident reported", message: "A new incident was logged for booth B-12.", time: Date.now() - 1000 * 60 * 12, read: false },
    { id: "n2", type: "crowd", title: "High crowd density", message: "Hall A is nearing capacity — consider redirecting attendees.", time: Date.now() - 1000 * 60 * 55, read: false },
    { id: "n3", type: "speaker", title: "Speaker cancellation", message: "A speaker cancelled their session; a replacement was suggested.", time: Date.now() - 1000 * 60 * 60 * 3, read: true },
    { id: "n4", type: "system", title: "Weekly summary ready", message: "Your weekly analytics summary has been generated.", time: Date.now() - 1000 * 60 * 60 * 20, read: true },
  ];
}

export function getGeneralSettings() {
  return read(KEYS.general, DEFAULT_GENERAL);
}
export function saveGeneralSettings(value) {
  write(KEYS.general, value);
}

export function getNotifPrefs() {
  return read(KEYS.notifPrefs, DEFAULT_NOTIF_PREFS);
}
export function saveNotifPrefs(value) {
  write(KEYS.notifPrefs, value);
}

export function getSecuritySettings() {
  return read(KEYS.security, DEFAULT_SECURITY);
}
export function saveSecuritySettings(value) {
  write(KEYS.security, value);
}

export function getIntegrations() {
  return read(KEYS.integrations, DEFAULT_INTEGRATIONS);
}
export function saveIntegrations(value) {
  write(KEYS.integrations, value);
}

export function getNotifications() {
  const existing = localStorage.getItem(KEYS.notifications);
  if (existing) {
    try {
      return JSON.parse(existing);
    } catch {
      /* fall through to reseed */
    }
  }
  const seeded = seedNotifications();
  write(KEYS.notifications, seeded);
  return seeded;
}
export function saveNotifications(value) {
  write(KEYS.notifications, value);
}
