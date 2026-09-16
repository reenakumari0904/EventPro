import jsPDF from "jspdf";
import { apiGet } from "../api";

// Fetches the latest real data from the backend and builds a PDF report
// that gets downloaded straight to the user's device.
export async function exportDashboardPdf() {
  const [stats, analytics, attendees] = await Promise.all([
    apiGet("/dashboard"),
    apiGet("/analytics"),
    apiGet("/attendees"),
  ]);

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

  heading("EventPro — Registration Report", 16);
  line(`Generated: ${new Date().toLocaleString()}`, 9);
  spacer();

  heading("Summary");
  line(`Total Registrations: ${stats.total_registrations}`);
  line(`Confirmed Registrations: ${stats.confirmed_registrations}`);
  line(`Checked-In: ${stats.checked_in}`);
  line(`Pending Check-In: ${stats.pending_checkin}`);
  line(`Cancelled: ${stats.cancelled}`);
  line(`Waitlisted: ${stats.waitlisted}`);
  spacer();

  heading("Registrations by Ticket Type");
  if (analytics.by_ticket_type?.length) {
    analytics.by_ticket_type.forEach((r) => line(`${r.ticket_type}: ${r.count}`));
  } else {
    line("No data yet.");
  }
  spacer();

  heading("Registrations by Source");
  if (analytics.by_source?.length) {
    analytics.by_source.forEach((r) => line(`${r.source}: ${r.count}`));
  } else {
    line("No data yet.");
  }
  spacer();
  ensureRoom();

  heading("Attendee List");
  if (attendees.length === 0) {
    line("No attendees registered yet.");
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Name", marginX, y);
    doc.text("Email", marginX + 45, y);
    doc.text("Ticket", marginX + 105, y);
    doc.text("Status", marginX + 135, y);
    y += 5;
    doc.setFont("helvetica", "normal");

    attendees.forEach((a) => {
      ensureRoom();
      doc.text(a.name.slice(0, 22), marginX, y);
      doc.text(a.email.slice(0, 28), marginX + 45, y);
      doc.text(a.ticket_type || "-", marginX + 105, y);
      doc.text(a.checkin_time ? "Checked-In" : "Not Checked-In", marginX + 135, y);
      y += 6;
    });
  }

  doc.save(`EventPro-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}