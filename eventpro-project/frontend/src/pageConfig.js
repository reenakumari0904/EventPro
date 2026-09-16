
// Navigation structure and page titles — this is UI configuration, not
// sample/dummy data. All actual attendee/event data comes from the backend.
import {
  LayoutGrid, ClipboardList, ScanLine, Users, BarChart3, Sparkles,
  Plug, Settings, MapPinned, ShieldAlert, Gauge, GitBranch,
} from "lucide-react";

export const navItems = [
  { key: "executive", label: "Executive Dashboard", icon: Gauge },
  { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { key: "registrations", label: "Registrations", icon: ClipboardList },
  { key: "checkin", label: "Check-in Tracking", icon: ScanLine },
  { key: "attendees", label: "Attendees", icon: Users },
  { key: "venue_speaker", label: "Venue & Speaker Ops", icon: MapPinned },
  { key: "sponsor_incident", label: "Sponsorship & Incidents", icon: ShieldAlert },
  { key: "workflows", label: "Agent Workflows", icon: GitBranch },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "ai", label: "AI Insights", icon: Sparkles },
  { key: "integrations", label: "Integrations", icon: Plug },
  { key: "settings", label: "Settings", icon: Settings },
];

export const pageTitles = {
  executive: ["Executive Dashboard", "Milestone 4 — Event Intelligence Engine: one health score and live insights across every module"],
  dashboard: ["Dashboard", null],
  registrations: ["Registration Agent", "Register a new attendee — saves directly to your database"],
  checkin: ["Check-in Tracking", "Scan or select an attendee's real QR code to check them in"],
  attendees: ["Attendees", null],
  venue_speaker: ["Venue & Speaker Operations", "Milestone 2 — venue optimization, speaker scheduling, session analytics"],
  sponsor_incident: ["Sponsorship & Incident Management", "Milestone 3 — sponsorship agent, incident agent, performance tracking, operational alerts"],
  workflows: ["Agent Workflows", "Reactive Agent Orchestration — trigger multi-agent workflows and approve human-in-the-loop decisions"],
  analytics: ["Analytics", null],
  ai: ["AI Insights", null],
  integrations: ["Integrations", null],
  settings: ["Settings", null],
};