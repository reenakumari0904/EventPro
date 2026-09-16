import jsPDF from "jspdf";
import { apiGet } from "../api";

function makeDoc() {
  const doc = new jsPDF();
  const marginX = 14;
  let y = 18;

  const heading = (text, size = 14) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.text(text, marginX, y);
    y += size === 14 ? 8 : 6;
  };
  const line = (text, size = 10) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.text(text, marginX, y);
    y += 6;
  };
  const spacer = (h = 4) => (y += h);
  const ensureRoom = () => {
    if (y > 275) {
      doc.addPage();
      y = 18;
    }
  };

  return { doc, marginX, heading, line, spacer, ensureRoom, get y() { return y; }, set y(v) { y = v; } };
}

export async function exportSponsorReportPdf() {
  const data = await apiGet("/sponsors/analytics");
  const { doc, heading, line, spacer, ensureRoom } = makeDoc();

  heading("EventPro — Sponsor Performance Report", 16);
  line(`Generated: ${new Date().toLocaleString()}`, 9);
  spacer();

  heading("Overview");
  line(`Top Engaged Sponsor: ${data.top_engaged_sponsor?.name || "—"} (${data.top_engaged_sponsor?.total_engagement_events || 0} events)`);
  line(`At-Risk Sponsors: ${data.at_risk_sponsors.length}`);
  spacer();

  heading("Engagement by Type");
  if (data.engagement_by_type.length === 0) {
    line("No engagement recorded yet.");
  } else {
    data.engagement_by_type.forEach((e) => line(`${e.metric_type.replace(/_/g, " ")}: ${e.total_value} (${e.event_count} events)`));
  }
  spacer();
  ensureRoom();

  heading("Sponsor Performance");
  data.sponsors.forEach((s) => {
    ensureRoom();
    line(`${s.name} (${s.tier || "—"}) — payment: ${s.payment_status}`);
    line(
      `  Deliverables: ${s.deliverable_completion_pct !== null ? s.deliverable_completion_pct + "%" : "—"} complete` +
        (s.conversion_rate_pct !== null ? `, conversion ${s.conversion_rate_pct}%` : "") +
        (s.at_risk_deliverables > 0 ? `, ${s.at_risk_deliverables} at risk` : ""),
      9
    );
  });
  spacer();
  ensureRoom();

  heading("At-Risk Sponsors");
  if (data.at_risk_sponsors.length === 0) {
    line("None — all deliverables on track.");
  } else {
    data.at_risk_sponsors.forEach((s) => line(`${s.name}: ${s.at_risk_deliverables} at-risk deliverable(s)`));
  }

  doc.save(`EventPro-Sponsor-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function exportIncidentReportPdf() {
  const data = await apiGet("/incidents/analytics");
  const { doc, heading, line, spacer, ensureRoom } = makeDoc();

  heading("EventPro — Incident Management Report", 16);
  line(`Generated: ${new Date().toLocaleString()}`, 9);
  spacer();

  heading("Overview");
  line(`Average Resolution Time: ${data.avg_resolution_minutes !== null ? data.avg_resolution_minutes + " minutes" : "—"}`);
  line(`Escalations Logged: ${data.escalation_count}`);
  spacer();

  heading("Open Incidents by Severity");
  if (data.open_by_severity.length === 0) {
    line("No open incidents.");
  } else {
    data.open_by_severity.forEach((s) => line(`${s.severity}: ${s.count}`));
  }
  spacer();

  heading("Incidents by Type");
  if (data.by_type.length === 0) {
    line("No incidents logged yet.");
  } else {
    data.by_type.forEach((t) => line(`${t.incident_type.replace(/_/g, " ")}: ${t.count}`));
  }
  spacer();
  ensureRoom();

  heading("Recent Incidents");
  if (data.recent_incidents.length === 0) {
    line("No incidents logged yet.");
  } else {
    data.recent_incidents.forEach((i) => {
      ensureRoom();
      line(`${i.title} — ${i.severity} / ${i.status} — ${i.venue_name || "no venue"} — ${new Date(i.reported_at).toLocaleString()}`, 9);
    });
  }
  spacer();
  ensureRoom();

  heading("Workflow History");
  if (data.workflow_history.length === 0) {
    line("No workflow actions logged yet.");
  } else {
    data.workflow_history.forEach((h) => {
      ensureRoom();
      line(`${h.title}: ${h.from_status || "new"} -> ${h.to_status} (${h.action}) by ${h.actor}`, 9);
    });
  }

  doc.save(`EventPro-Incident-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}
