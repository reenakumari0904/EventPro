import React, { useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import DashboardPage from "./pages/DashboardPage";
import RegistrationAgentPage from "./pages/RegistrationAgentPage";
import CheckinPage from "./pages/CheckinPage";
import VenueSpeakerOpsPage from "./pages/VenueSpeakerOpsPage";
import SponsorIncidentOpsPage from "./pages/SponsorIncidentOpsPage";
import WorkflowsPage from "./pages/WorkflowsPage";
import ExecutiveDashboardPage from "./pages/ExecutiveDashboardPage";
import AttendeesPage from "./pages/AttendeesPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import AIInsightsPage from "./pages/AIInsightsPage";
import SettingsPage from "./pages/SettingsPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import Placeholder from "./pages/Placeholder";
import AdminAuthPage from "./AdminAuthPage";
import { pageTitles } from "./pageConfig";
import { BG } from "./theme";
import { exportDashboardPdf } from "./utils/exportPdf";
import { getToken, clearToken } from "./api";

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [loggedIn, setLoggedIn] = useState(() => Boolean(getToken()));

  const logout = () => {
    clearToken();
    setLoggedIn(false);
  };

  if (!loggedIn) {
    return <AdminAuthPage onLoggedIn={() => setLoggedIn(true)} />;
  }

  const goTo = (key) => {
    setPage(key);
    setSidebarOpen(false);
  };

  const render = () => {
    switch (page) {
      case "dashboard":
        return <DashboardPage />;
      case "registrations":
        return <RegistrationAgentPage />;
      case "checkin":
        return <CheckinPage />;
      case "attendees":
        return <AttendeesPage />;
      case "executive":
        return <ExecutiveDashboardPage />;
      case "venue_speaker":
        return <VenueSpeakerOpsPage />;
      case "sponsor_incident":
        return <SponsorIncidentOpsPage />;
      case "workflows":
        return <WorkflowsPage />;
      case "analytics":
        return <AnalyticsPage />;
      case "ai":
        return <AIInsightsPage />;
      case "integrations":
        return <IntegrationsPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <Placeholder title={pageTitles[page][0]} />;
    }
  };

  return (
    <div className="app-shell" style={{ display: "flex", height: "100vh", fontFamily: "'Inter', system-ui, sans-serif", background: BG }}>
      <Sidebar active={page} setActive={goTo} onLogout={logout} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div
        className={`sidebar-overlay${sidebarOpen ? " open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />
      <div className="main-col" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <Topbar
          title={pageTitles[page][0]}
          subtitle={pageTitles[page][1]}
          onExport={page === "dashboard" ? exportDashboardPdf : null}
          onNavigate={goTo}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
        />
        <div style={{ flex: 1, overflowY: "auto" }}>{render()}</div>
      </div>
    </div>
  );
}
