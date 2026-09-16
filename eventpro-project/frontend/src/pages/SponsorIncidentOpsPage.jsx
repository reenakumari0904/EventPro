import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Handshake, Siren, Bell, BarChart3, ActivitySquare, Sparkles, AlertTriangle, CheckCircle2, Clock, Lightbulb, Download,
} from "lucide-react";
import Card from "../components/Card";
import { PURPLE, NAVY } from "../theme";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";
import { exportSponsorReportPdf, exportIncidentReportPdf } from "../utils/exportSponsorIncidentPdf";

const CHART_COLORS = ["#7C5CFC", "#4C9AFF", "#F5A623", "#2FC59B", "#F0678E", "#6D4CF0"];

const TABS = [
  { key: "sponsors", label: "Sponsors", icon: Handshake },
  { key: "incidents", label: "Incidents", icon: Siren },
  { key: "alerts", label: "Operational Alerts", icon: Bell },
  { key: "recommendations", label: "AI Recommendations", icon: Lightbulb },
  { key: "sponsor_analytics", label: "Sponsor Analytics", icon: BarChart3 },
  { key: "incident_analytics", label: "Incident Analytics", icon: ActivitySquare },
];

const labelStyle = { fontSize: 12, color: "#8B87A0", display: "block", marginBottom: 6 };
const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E3E0F1",
  fontSize: 13, outline: "none", boxSizing: "border-box",
};
function Field({ label, ...props }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input style={inputStyle} {...props} />
    </div>
  );
}
function Select({ label, options, ...props }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select style={inputStyle} {...props}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function StatBox({ label, value, sub, icon: Icon }) {
  return (
    <Card style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        {Icon && <Icon size={15} color={PURPLE} />}
        <div style={{ fontSize: 12, color: "#8B87A0" }}>{label}</div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: NAVY }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#9490A8", marginTop: 2 }}>{sub}</div>}
    </Card>
  );
}

const SEVERITY_STYLE = {
  critical: { color: "#C23A5B", bg: "#FDE7EC" },
  high: { color: "#D97B1F", bg: "#FFF1DE" },
  medium: { color: "#B08900", bg: "#FFF8DE" },
  low: { color: "#4C9AFF", bg: "#EAF3FF" },
  informational: { color: "#6B6580", bg: "#F0EEF8" },
};
function SeverityBadge({ level }) {
  const s = SEVERITY_STYLE[level] || SEVERITY_STYLE.medium;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: s.color, background: s.bg, padding: "3px 9px", borderRadius: 999, textTransform: "uppercase" }}>
      {level}
    </span>
  );
}

export default function SponsorIncidentOpsPage() {
  const [tab, setTab] = useState("sponsors");

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999,
                border: active ? "none" : "1px solid #E3E0F1", background: active ? PURPLE : "#fff",
                color: active ? "#fff" : "#4B4768", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "sponsors" && <SponsorsTab />}
      {tab === "incidents" && <IncidentsTab />}
      {tab === "alerts" && <AlertsTab />}
      {tab === "recommendations" && <RecommendationsTab />}
      {tab === "sponsor_analytics" && <SponsorAnalyticsTab />}
      {tab === "incident_analytics" && <IncidentAnalyticsTab />}
    </div>
  );
}

// ==================== Sponsors ====================
function SponsorsTab() {
  const [sponsors, setSponsors] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [payments, setPayments] = useState([]);
  const [packages, setPackages] = useState([]);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "", tier: "Silver", contact_name: "", contact_email: "", contract_amount: "", payment_status: "pending",
    contract_start_date: "", contract_end_date: "", contract_notes: "",
  });
  const [delivForm, setDelivForm] = useState({ sponsor_id: "", description: "", deliverable_type: "branding", due_date: "", spec_dimensions: "", spec_format: "" });
  const [engageForm, setEngageForm] = useState({ sponsor_id: "", metric_type: "booth_visit", metric_value: 1, notes: "" });
  const [paymentForm, setPaymentForm] = useState({ sponsor_id: "", amount: "", payment_date: "", method: "bank_transfer", notes: "" });
  const [packageForm, setPackageForm] = useState({ name: "", tier: "Platinum", description: "", items: [{ description: "", deliverable_type: "branding" }] });
  const [assignForm, setAssignForm] = useState({ sponsor_id: "", package_id: "", due_date: "" });

  const load = () => {
    apiGet("/sponsors").then(setSponsors).catch((err) => setError(err.message));
    apiGet("/sponsors/deliverables").then(setDeliverables).catch(() => {});
    apiGet("/sponsors/payments").then(setPayments).catch(() => {});
    apiGet("/sponsorship-packages").then(setPackages).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const submitSponsor = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await apiPost("/sponsors", { ...form, contract_amount: form.contract_amount ? parseFloat(form.contract_amount) : null });
      setForm({ name: "", tier: "Silver", contact_name: "", contact_email: "", contract_amount: "", payment_status: "pending", contract_start_date: "", contract_end_date: "", contract_notes: "" });
      load();
    } catch (err) { setError(err.message); }
  };

  const submitDeliverable = async (e) => {
    e.preventDefault();
    setError("");
    if (!delivForm.sponsor_id) { setError("Pick a sponsor for this deliverable."); return; }
    try {
      const { sponsor_id, ...body } = delivForm;
      await apiPost(`/sponsors/${sponsor_id}/deliverables`, body);
      setDelivForm({ sponsor_id: "", description: "", deliverable_type: "branding", due_date: "", spec_dimensions: "", spec_format: "" });
      load();
    } catch (err) { setError(err.message); }
  };

  const submitEngagement = async (e) => {
    e.preventDefault();
    setError("");
    if (!engageForm.sponsor_id) { setError("Pick a sponsor to log engagement for."); return; }
    try {
      const { sponsor_id, ...body } = engageForm;
      await apiPost(`/sponsors/${sponsor_id}/engagement`, { ...body, metric_value: parseInt(body.metric_value, 10) || 1 });
      setEngageForm({ sponsor_id: "", metric_type: "booth_visit", metric_value: 1, notes: "" });
      load();
    } catch (err) { setError(err.message); }
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    setError("");
    if (!paymentForm.sponsor_id || !paymentForm.amount) { setError("Pick a sponsor and enter an amount."); return; }
    try {
      const { sponsor_id, ...body } = paymentForm;
      await apiPost(`/sponsors/${sponsor_id}/payments`, { ...body, amount: parseFloat(body.amount) });
      setPaymentForm({ sponsor_id: "", amount: "", payment_date: "", method: "bank_transfer", notes: "" });
      load();
    } catch (err) { setError(err.message); }
  };

  const updatePackageItem = (idx, field, value) => {
    const items = [...packageForm.items];
    items[idx] = { ...items[idx], [field]: value };
    setPackageForm({ ...packageForm, items });
  };
  const addPackageItemRow = () => setPackageForm({ ...packageForm, items: [...packageForm.items, { description: "", deliverable_type: "branding" }] });
  const removePackageItemRow = (idx) => setPackageForm({ ...packageForm, items: packageForm.items.filter((_, i) => i !== idx) });

  const submitPackage = async (e) => {
    e.preventDefault();
    setError("");
    const cleanItems = packageForm.items.filter((i) => i.description.trim());
    if (!packageForm.name || cleanItems.length === 0) { setError("Package name and at least one item are required."); return; }
    try {
      await apiPost("/sponsorship-packages", { ...packageForm, items: cleanItems });
      setPackageForm({ name: "", tier: "Platinum", description: "", items: [{ description: "", deliverable_type: "branding" }] });
      load();
    } catch (err) { setError(err.message); }
  };

  const submitAssignPackage = async (e) => {
    e.preventDefault();
    setError("");
    if (!assignForm.sponsor_id || !assignForm.package_id) { setError("Pick a sponsor and a package to assign."); return; }
    try {
      const { sponsor_id, ...body } = assignForm;
      const result = await apiPost(`/sponsors/${sponsor_id}/assign-package`, body);
      setAssignForm({ sponsor_id: "", package_id: "", due_date: "" });
      load();
      setError(`Created ${result.count} deliverable(s) from the package.`);
    } catch (err) { setError(err.message); }
  };

  const setDeliverableStatus = async (deliverableId, status) => {
    try { await apiPut(`/sponsors/deliverables/${deliverableId}`, { status }); load(); } catch (err) { setError(err.message); }
  };
  const setDeliverableApproval = async (deliverableId, approval_status) => {
    try { await apiPut(`/sponsors/deliverables/${deliverableId}/approval`, { approval_status }); load(); } catch (err) { setError(err.message); }
  };

  const removeSponsor = async (id) => {
    try { await apiDelete(`/sponsors/${id}`); load(); } catch (err) { setError(err.message); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {error && <div style={{ fontSize: 12, color: error.startsWith("Created") ? "#1E9C74" : "#C23A5B", background: error.startsWith("Created") ? "#E3FBF3" : "#FDE7EC", padding: "8px 12px", borderRadius: 8 }}>{error}</div>}

      <Card>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 12 }}>Add Sponsor</div>
        <form onSubmit={submitSponsor} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Select label="Tier" value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}
            options={["Platinum", "Gold", "Silver", "Bronze"].map((t) => ({ value: t, label: t }))} />
          <Select label="Payment Status" value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value })}
            options={["pending", "partial", "paid"].map((s) => ({ value: s, label: s }))} />
          <Field label="Contact Name" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          <Field label="Contact Email" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
          <Field label="Contract Amount" type="number" value={form.contract_amount} onChange={(e) => setForm({ ...form, contract_amount: e.target.value })} />
          <Field label="Contract Start Date" type="date" value={form.contract_start_date} onChange={(e) => setForm({ ...form, contract_start_date: e.target.value })} />
          <Field label="Contract End Date" type="date" value={form.contract_end_date} onChange={(e) => setForm({ ...form, contract_end_date: e.target.value })} />
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Contract Notes (terms, special clauses, etc.)" value={form.contract_notes} onChange={(e) => setForm({ ...form, contract_notes: e.target.value })} />
          </div>
          <button type="submit" style={{ gridColumn: "1 / -1", background: PURPLE, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Add Sponsor
          </button>
        </form>
      </Card>

      <Card>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 12 }}>Sponsor Roster</div>
        {sponsors.length === 0 ? (
          <div style={{ fontSize: 12, color: "#B0ACC4" }}>No sponsors yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sponsors.map((s) => (
              <div key={s.sponsor_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#F9F8FD", borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{s.name} <span style={{ fontSize: 10, color: PURPLE, fontWeight: 600 }}>· {s.tier}</span></div>
                  <div style={{ fontSize: 11, color: "#9490A8" }}>{s.contact_email || "No contact email"} · {s.payment_status} {s.contract_amount ? `· ₹${Number(s.contract_amount).toLocaleString()}` : ""}</div>
                  {(s.contract_start_date || s.contract_end_date) && (
                    <div style={{ fontSize: 10, color: "#B0ACC4" }}>
                      Contract: {s.contract_start_date ? new Date(s.contract_start_date).toLocaleDateString() : "?"} → {s.contract_end_date ? new Date(s.contract_end_date).toLocaleDateString() : "?"}
                    </div>
                  )}
                </div>
                <button onClick={() => removeSponsor(s.sponsor_id)} style={{ background: "none", border: "1px solid #F0D0DA", color: "#C23A5B", borderRadius: 8, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 12 }}>Add Deliverable</div>
          <form onSubmit={submitDeliverable} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Select label="Sponsor" value={delivForm.sponsor_id} onChange={(e) => setDelivForm({ ...delivForm, sponsor_id: e.target.value })}
              options={[{ value: "", label: "Select a sponsor" }, ...sponsors.map((s) => ({ value: s.sponsor_id, label: s.name }))]} />
            <Field label="Description" placeholder="e.g. Main-stage branding" value={delivForm.description} onChange={(e) => setDelivForm({ ...delivForm, description: e.target.value })} required />
            <Select label="Type" value={delivForm.deliverable_type} onChange={(e) => setDelivForm({ ...delivForm, deliverable_type: e.target.value })}
              options={["branding", "session", "booth", "social", "passes", "other"].map((t) => ({ value: t, label: t }))} />
            <Field label="Due Date" type="date" value={delivForm.due_date} onChange={(e) => setDelivForm({ ...delivForm, due_date: e.target.value })} />
            {delivForm.deliverable_type === "branding" && (
              <>
                <Field label="Dimensions (branding spec)" placeholder='e.g. "10ft x 4ft banner"' value={delivForm.spec_dimensions} onChange={(e) => setDelivForm({ ...delivForm, spec_dimensions: e.target.value })} />
                <Field label="Format (branding spec)" placeholder='e.g. "PNG, transparent background"' value={delivForm.spec_format} onChange={(e) => setDelivForm({ ...delivForm, spec_format: e.target.value })} />
              </>
            )}
            <button type="submit" style={{ background: NAVY, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Add Deliverable
            </button>
          </form>
        </Card>

        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 12 }}>Log Engagement</div>
          <form onSubmit={submitEngagement} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Select label="Sponsor" value={engageForm.sponsor_id} onChange={(e) => setEngageForm({ ...engageForm, sponsor_id: e.target.value })}
              options={[{ value: "", label: "Select a sponsor" }, ...sponsors.map((s) => ({ value: s.sponsor_id, label: s.name }))]} />
            <Select label="Metric" value={engageForm.metric_type} onChange={(e) => setEngageForm({ ...engageForm, metric_type: e.target.value })}
              options={["booth_visit", "lead", "conversion", "session_participation", "social_mention", "promotional_activity"].map((t) => ({ value: t, label: t.replace("_", " ") }))} />
            <Field label="Value" type="number" min="1" value={engageForm.metric_value} onChange={(e) => setEngageForm({ ...engageForm, metric_value: e.target.value })} />
            <Field label="Notes (optional)" value={engageForm.notes} onChange={(e) => setEngageForm({ ...engageForm, notes: e.target.value })} />
            <button type="submit" style={{ background: PURPLE, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Log Engagement
            </button>
          </form>
        </Card>
      </div>

      <Card>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 12 }}>Deliverables</div>
        {deliverables.length === 0 ? (
          <div style={{ fontSize: 12, color: "#B0ACC4" }}>No deliverables logged yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {deliverables.map((d) => (
              <div key={d.deliverable_id} style={{ padding: "10px 12px", background: "#F9F8FD", borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{d.description} <span style={{ fontSize: 11, color: "#9490A8" }}>— {d.sponsor_name}</span></div>
                    <div style={{ fontSize: 11, color: "#9490A8" }}>{d.deliverable_type} · due {d.due_date ? new Date(d.due_date).toLocaleDateString() : "no date set"}</div>
                    {(d.spec_dimensions || d.spec_format) && (
                      <div style={{ fontSize: 10, color: "#B0ACC4" }}>{d.spec_dimensions || ""} {d.spec_format ? `· ${d.spec_format}` : ""}</div>
                    )}
                  </div>
                  <select value={d.status} onChange={(e) => setDeliverableStatus(d.deliverable_id, e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 12 }}>
                    <option value="pending">pending</option>
                    <option value="completed">completed</option>
                    <option value="at_risk">at_risk</option>
                  </select>
                </div>
                {d.deliverable_type === "branding" && (
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, color: "#9490A8" }}>Brand approval:</span>
                    <select value={d.approval_status} onChange={(e) => setDeliverableApproval(d.deliverable_id, e.target.value)} style={{ ...inputStyle, width: "auto", padding: "4px 8px", fontSize: 11 }}>
                      <option value="pending_approval">pending_approval</option>
                      <option value="approved">approved</option>
                      <option value="rejected">rejected</option>
                      <option value="not_required">not_required</option>
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 12 }}>Record Payment</div>
          <form onSubmit={submitPayment} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Select label="Sponsor" value={paymentForm.sponsor_id} onChange={(e) => setPaymentForm({ ...paymentForm, sponsor_id: e.target.value })}
              options={[{ value: "", label: "Select a sponsor" }, ...sponsors.map((s) => ({ value: s.sponsor_id, label: s.name }))]} />
            <Field label="Amount" type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
            <Field label="Payment Date" type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
            <Select label="Method" value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
              options={["bank_transfer", "cheque", "card", "cash", "other"].map((m) => ({ value: m, label: m.replace("_", " ") }))} />
            <Field label="Notes (optional)" value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
            <button type="submit" style={{ background: PURPLE, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Record Payment
            </button>
          </form>
          <div style={{ fontSize: 10, color: "#9490A8", marginTop: 10 }}>Payment status updates automatically once payments cover the contract amount.</div>
        </Card>

        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 12 }}>Payment History</div>
          {payments.length === 0 ? (
            <div style={{ fontSize: 12, color: "#B0ACC4" }}>No payments recorded yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
              {payments.map((p) => (
                <div key={p.payment_id} style={{ padding: "8px 10px", background: "#F9F8FD", borderRadius: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{p.sponsor_name} — ₹{Number(p.amount).toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: "#9490A8" }}>{p.method.replace("_", " ")} · {new Date(p.payment_date).toLocaleDateString()}{p.notes ? ` · ${p.notes}` : ""}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 4 }}>Create Sponsorship Package</div>
          <div style={{ fontSize: 11, color: "#9490A8", marginBottom: 12 }}>Define a reusable bundle so you don't retype the same deliverables for every sponsor of that tier.</div>
          <form onSubmit={submitPackage} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Package Name" placeholder='e.g. "Platinum Package"' value={packageForm.name} onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })} required />
            <Select label="Tier" value={packageForm.tier} onChange={(e) => setPackageForm({ ...packageForm, tier: e.target.value })}
              options={["Platinum", "Gold", "Silver", "Bronze"].map((t) => ({ value: t, label: t }))} />
            <Field label="Description (optional)" value={packageForm.description} onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })} />
            <div style={{ fontSize: 11, fontWeight: 600, color: "#4B4768" }}>Package Items</div>
            {packageForm.items.map((item, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8 }}>
                <input style={{ ...inputStyle, flex: 2 }} placeholder="e.g. Main-stage branding" value={item.description} onChange={(e) => updatePackageItem(idx, "description", e.target.value)} />
                <select style={{ ...inputStyle, flex: 1 }} value={item.deliverable_type} onChange={(e) => updatePackageItem(idx, "deliverable_type", e.target.value)}>
                  {["branding", "session", "booth", "social", "passes", "other"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {packageForm.items.length > 1 && (
                  <button type="button" onClick={() => removePackageItemRow(idx)} style={{ background: "none", border: "1px solid #F0D0DA", color: "#C23A5B", borderRadius: 8, padding: "0 10px", cursor: "pointer" }}>×</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addPackageItemRow} style={{ background: "#fff", border: "1px solid #E3E0F1", color: "#4B4768", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer", alignSelf: "flex-start" }}>
              + Add Item
            </button>
            <button type="submit" style={{ background: NAVY, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Create Package
            </button>
          </form>
        </Card>

        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 4 }}>Assign Package to Sponsor</div>
          <div style={{ fontSize: 11, color: "#9490A8", marginBottom: 12 }}>Creates every item in the package as a deliverable for that sponsor in one action.</div>
          <form onSubmit={submitAssignPackage} style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            <Select label="Sponsor" value={assignForm.sponsor_id} onChange={(e) => setAssignForm({ ...assignForm, sponsor_id: e.target.value })}
              options={[{ value: "", label: "Select a sponsor" }, ...sponsors.map((s) => ({ value: s.sponsor_id, label: s.name }))]} />
            <Select label="Package" value={assignForm.package_id} onChange={(e) => setAssignForm({ ...assignForm, package_id: e.target.value })}
              options={[{ value: "", label: "Select a package" }, ...packages.map((p) => ({ value: p.package_id, label: `${p.name} (${p.items.length} items)` }))]} />
            <Field label="Due Date (applies to all items)" type="date" value={assignForm.due_date} onChange={(e) => setAssignForm({ ...assignForm, due_date: e.target.value })} />
            <button type="submit" style={{ background: PURPLE, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Assign Package
            </button>
          </form>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#4B4768", marginBottom: 8 }}>Existing Packages</div>
          {packages.length === 0 ? (
            <div style={{ fontSize: 12, color: "#B0ACC4" }}>No packages created yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
              {packages.map((p) => (
                <div key={p.package_id} style={{ fontSize: 11, color: "#4B4768", padding: "6px 8px", background: "#F9F8FD", borderRadius: 8 }}>
                  <strong style={{ color: NAVY }}>{p.name}</strong> ({p.tier}) — {p.items.map((i) => i.description).join(", ")}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ==================== Incidents ====================
const INCIDENT_TYPES = [
  "speaker_cancellation", "venue_technical", "registration_failure", "large_scale_registration_failure",
  "network_outage", "power_failure", "overcrowding", "medical_emergency", "security", "venue_evacuation",
  "major_system_failure", "av_failure", "session_delay", "missing_equipment", "vip_issue", "other",
];

function IncidentsTab() {
  const [incidents, setIncidents] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", description: "", incident_type: "other", reported_by: "" });
  const [triage, setTriage] = useState(null);
  const [triageLoading, setTriageLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  const load = () => {
    apiGet(statusFilter ? `/incidents?status=${statusFilter}` : "/incidents").then(setIncidents).catch((err) => setError(err.message));
  };
  useEffect(() => { load(); }, [statusFilter]);

  const runTriage = async () => {
    setError(""); setTriage(null); setTriageLoading(true);
    try {
      const result = await apiPost("/incidents/ai-triage", form);
      setTriage(result);
    } catch (err) { setError(err.message); } finally { setTriageLoading(false); }
  };

  const submitIncident = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await apiPost("/incidents", { ...form, severity: triage?.severity || undefined });
      setForm({ title: "", description: "", incident_type: "other", reported_by: "" });
      setTriage(null);
      load();
    } catch (err) { setError(err.message); }
  };

  const changeStatus = async (id, status) => {
    try { await apiPut(`/incidents/${id}/status`, { status, actor: "organizer" }); load(); } catch (err) { setError(err.message); }
  };
  const escalate = async (id) => {
    try { await apiPost(`/incidents/${id}/escalate`, { actor: "organizer" }); load(); } catch (err) { setError(err.message); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {error && <div style={{ fontSize: 12, color: "#C23A5B", background: "#FDE7EC", padding: "8px 12px", borderRadius: 8 }}>{error}</div>}

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
          <Siren size={15} color={PURPLE} /> Report an Incident
        </div>
        <div style={{ fontSize: 12, color: "#9490A8", marginBottom: 16 }}>
          Severity is auto-classified by incident type, or run AI Triage for a reasoned recommendation first.
        </div>
        <form onSubmit={submitIncident} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <Select label="Incident Type" value={form.incident_type} onChange={(e) => setForm({ ...form, incident_type: e.target.value })}
            options={INCIDENT_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, " ") }))} />
          <Field label="Reported By" value={form.reported_by} onChange={(e) => setForm({ ...form, reported_by: e.target.value })} />
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10 }}>
            <button type="button" onClick={runTriage} disabled={triageLoading} style={{ background: "#fff", border: `1px solid ${PURPLE}`, color: PURPLE, padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <Sparkles size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} /> {triageLoading ? "Analyzing…" : "AI Triage"}
            </button>
            <button type="submit" style={{ background: PURPLE, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Report Incident
            </button>
          </div>
        </form>
        {triage && (
          <div style={{ marginTop: 14, background: "#F3F1FE", borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <SeverityBadge level={triage.severity} />
              {triage.escalate && <span style={{ fontSize: 11, color: "#C23A5B", fontWeight: 600 }}>Recommend escalation</span>}
            </div>
            <div style={{ fontSize: 12, color: "#4B4768" }}>{triage.recommended_action}</div>
            <div style={{ fontSize: 11, color: "#9490A8", fontStyle: "italic", marginTop: 4 }}>"{triage.reasoning}"</div>
          </div>
        )}
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: NAVY }}>Incidents</div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 12 }}>
            <option value="">All statuses</option>
            {["reported", "acknowledged", "in_progress", "escalated", "resolved", "closed"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {incidents.length === 0 ? (
          <div style={{ fontSize: 12, color: "#B0ACC4" }}>No incidents match this filter.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {incidents.map((i) => (
              <div key={i.incident_id} style={{ padding: "10px 12px", borderRadius: 10, background: "#F9F8FD" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <SeverityBadge level={i.severity} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{i.title}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#9490A8", marginTop: 3 }}>
                      {i.incident_type.replace(/_/g, " ")} · {i.venue_name || "no venue"} · {i.session_title || "no session"} · {new Date(i.reported_at).toLocaleString()}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: NAVY, background: "#EFEDF7", padding: "3px 9px", borderRadius: 999 }}>{i.status}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  {["acknowledged", "in_progress", "resolved", "closed"].map((s) => (
                    <button key={s} onClick={() => changeStatus(i.incident_id, s)} style={{ fontSize: 11, background: "#fff", border: "1px solid #E3E0F1", color: "#4B4768", borderRadius: 8, padding: "4px 9px", cursor: "pointer" }}>
                      Mark {s}
                    </button>
                  ))}
                  <button onClick={() => escalate(i.incident_id)} style={{ fontSize: 11, background: "#FDE7EC", border: "1px solid #F0D0DA", color: "#C23A5B", borderRadius: 8, padding: "4px 9px", cursor: "pointer" }}>
                    Escalate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ==================== Operational Alerts ====================
function AlertsTab() {
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [predictResult, setPredictResult] = useState(null);

  const load = () => apiGet("/alerts").then(setAlerts).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  const runScan = async () => {
    setError(""); setScanResult(null); setScanning(true);
    try {
      const result = await apiPost("/alerts/generate", {});
      setScanResult(result);
      load();
    } catch (err) { setError(err.message); } finally { setScanning(false); }
  };

  const runPredict = async () => {
    setError(""); setPredictResult(null); setPredicting(true);
    try {
      const result = await apiPost("/alerts/ai-predict", {});
      setPredictResult(result);
      load();
    } catch (err) { setError(err.message); } finally { setPredicting(false); }
  };

  const acknowledge = async (id) => {
    try { await apiPut(`/alerts/${id}/acknowledge`, {}); load(); } catch (err) { setError(err.message); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {error && <div style={{ fontSize: 12, color: "#C23A5B", background: "#FDE7EC", padding: "8px 12px", borderRadius: 8 }}>{error}</div>}

      <div style={{ display: "flex", gap: 16 }}>
        <Card style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
            <Bell size={15} color={PURPLE} /> Rule-Based Scan
          </div>
          <div style={{ fontSize: 12, color: "#9490A8", marginBottom: 12 }}>
            Checks overdue sponsor deliverables and rooms near capacity right now.
          </div>
          <button onClick={runScan} disabled={scanning} style={{ background: PURPLE, color: "#fff", border: "none", padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {scanning ? "Scanning…" : "Run Scan"}
          </button>
          {scanResult && <div style={{ fontSize: 11, color: "#9490A8", marginTop: 8 }}>{scanResult.count} new alert(s) created.</div>}
        </Card>

        <Card style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
            <Sparkles size={15} color={PURPLE} /> AI Predictive Check
          </div>
          <div style={{ fontSize: 12, color: "#9490A8", marginBottom: 12 }}>
            Looks at check-in velocity for sessions in progress and predicts whether a capacity issue is forming.
          </div>
          <button onClick={runPredict} disabled={predicting} style={{ background: "#fff", border: `1px solid ${PURPLE}`, color: PURPLE, padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {predicting ? "Analyzing…" : "Run AI Prediction"}
          </button>
          {predictResult && (
            <div style={{ fontSize: 11, color: "#9490A8", marginTop: 8 }}>
              {predictResult.alert ? "New AI alert created below." : predictResult.reasoning || predictResult.message}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 12 }}>Alerts</div>
        {alerts.length === 0 ? (
          <div style={{ fontSize: 12, color: "#B0ACC4" }}>No alerts yet — run a scan above.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alerts.map((a) => (
              <div key={a.alert_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, background: a.acknowledged ? "#F9F8FD" : "#FFF9F0" }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <SeverityBadge level={a.alert_level} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{a.title}</span>
                    {a.is_ai_generated && <Sparkles size={12} color={PURPLE} />}
                  </div>
                  <div style={{ fontSize: 12, color: "#4B4768", marginTop: 3 }}>{a.message}</div>
                  <div style={{ fontSize: 10, color: "#9490A8", marginTop: 2 }}>{new Date(a.created_at).toLocaleString()}</div>
                </div>
                {!a.acknowledged && (
                  <button onClick={() => acknowledge(a.alert_id)} style={{ fontSize: 11, background: "#fff", border: "1px solid #E3E0F1", color: "#4B4768", borderRadius: 8, padding: "5px 10px", cursor: "pointer", whiteSpace: "nowrap" }}>
                    <CheckCircle2 size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} /> Acknowledge
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ==================== AI Recommendations ====================
const REC_PRIORITY_STYLE = {
  high: { color: "#C23A5B", bg: "#FDE7EC" },
  medium: { color: "#B08900", bg: "#FFF8DE" },
  low: { color: "#4C9AFF", bg: "#EAF3FF" },
};

function RecommendationsTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [summarizing, setSummarizing] = useState(false);

  const load = () => apiGet("/recommendations").then(setData).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  const generateSummary = async () => {
    setError(""); setSummary(null); setSummarizing(true);
    try {
      const result = await apiPost("/recommendations/ai-summary", {});
      setSummary(result.summary);
    } catch (err) { setError(err.message); } finally { setSummarizing(false); }
  };

  if (error && !data) return <div style={{ fontSize: 13, color: "#C23A5B", background: "#FDE7EC", padding: "10px 14px", borderRadius: 10 }}>{error}</div>;
  if (!data) return <div style={{ fontSize: 13, color: "#9490A8" }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 16 }}>
        <StatBox icon={Lightbulb} label="Open Recommendations" value={data.count} sub="Across sponsors and incidents" />
      </div>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
          <Sparkles size={15} color={PURPLE} /> AI Summary
        </div>
        <div style={{ fontSize: 12, color: "#9490A8", marginBottom: 12 }}>
          This scan runs automatically — no question needed. It looks across every sponsor and incident right now
          and surfaces what needs attention, prioritized high to low. Generate a short narrative summary of it below.
        </div>
        {error && <div style={{ fontSize: 12, color: "#C23A5B", background: "#FDE7EC", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{error}</div>}
        <button onClick={generateSummary} disabled={summarizing} style={{ background: PURPLE, color: "#fff", border: "none", padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {summarizing ? "Summarizing…" : "Generate AI Summary"}
        </button>
        {summary && <div style={{ marginTop: 12, background: "#F3F1FE", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#4B4768" }}>{summary}</div>}
      </Card>

      <Card>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 12 }}>Recommendations</div>
        {data.recommendations.length === 0 ? (
          <div style={{ fontSize: 12, color: "#B0ACC4" }}>Nothing needs attention right now — every sponsor and incident looks on track.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.recommendations.map((r, idx) => {
              const style = REC_PRIORITY_STYLE[r.priority] || REC_PRIORITY_STYLE.medium;
              return (
                <div key={idx} style={{ padding: "10px 12px", borderRadius: 10, background: "#F9F8FD" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: style.color, background: style.bg, padding: "3px 9px", borderRadius: 999, textTransform: "uppercase" }}>{r.priority}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#9490A8" }}>{r.category}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{r.title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#4B4768", marginTop: 4 }}>{r.message}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}


function SponsorAnalyticsTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [asking, setAsking] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = () => apiGet("/sponsors/analytics").then(setData).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  const ask = async () => {
    setAiResult(null); setAsking(true);
    try {
      const result = await apiPost("/sponsors/ai-insights", { question });
      setAiResult(result);
    } catch (err) { setError(err.message); } finally { setAsking(false); }
  };

  const doExport = async () => {
    setExporting(true);
    try { await exportSponsorReportPdf(); } catch (err) { setError(err.message); } finally { setExporting(false); }
  };

  if (error) return <div style={{ fontSize: 13, color: "#C23A5B", background: "#FDE7EC", padding: "10px 14px", borderRadius: 10 }}>{error}</div>;
  if (!data) return <div style={{ fontSize: 13, color: "#9490A8" }}>Loading…</div>;

  const engagementChartData = data.engagement_by_type.map((e) => ({ name: e.metric_type.replace(/_/g, " "), value: parseInt(e.total_value, 10) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
        <StatBox icon={Handshake} label="Top Engaged Sponsor" value={data.top_engaged_sponsor?.name || "—"} sub={data.top_engaged_sponsor ? `${data.top_engaged_sponsor.total_engagement_events} events` : ""} />
        <StatBox icon={AlertTriangle} label="At-Risk Sponsors" value={data.at_risk_sponsors.length} sub="Have overdue/at-risk deliverables" />
        <button onClick={doExport} disabled={exporting} style={{ background: "#fff", border: `1px solid ${PURPLE}`, color: PURPLE, padding: "0 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          <Download size={14} /> {exporting ? "Exporting…" : "Export Report"}
        </button>
      </div>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
          <Sparkles size={15} color={PURPLE} /> Ask the Sponsorship Agent
        </div>
        <div style={{ fontSize: 12, color: "#9490A8", marginBottom: 12 }}>
          e.g. "Which sponsors have pending deliverables?" · "Which sponsor has the highest attendee engagement?" · "Which sponsors are at risk of not receiving their promised benefits?"
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input style={{ ...inputStyle, flex: 1 }} placeholder="Ask a question about sponsor data…" value={question} onChange={(e) => setQuestion(e.target.value)} />
          <button onClick={ask} disabled={asking} style={{ background: PURPLE, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            {asking ? "Thinking…" : "Ask"}
          </button>
        </div>
        {aiResult?.ai_answer && (
          <div style={{ marginTop: 12, background: "#F3F1FE", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#4B4768" }}>{aiResult.ai_answer}</div>
        )}
        {aiResult && !aiResult.ai_answer && (
          <div style={{ marginTop: 12, fontSize: 11, color: "#9490A8" }}>
            No GEMINI_API_KEY configured — showing rule-based data only. Pending deliverables: {aiResult.pending_deliverables.length}, at-risk sponsors: {aiResult.at_risk_sponsors.length}.
          </div>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 10 }}>Engagement by Type</div>
          {engagementChartData.length === 0 ? (
            <div style={{ fontSize: 12, color: "#B0ACC4" }}>No engagement logged yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={engagementChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {engagementChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 10 }}>Sponsor Performance</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
            {data.sponsors.map((s) => (
              <div key={s.sponsor_id} style={{ padding: "8px 10px", borderRadius: 10, background: "#F9F8FD" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{s.name} <span style={{ fontWeight: 500, color: "#9490A8" }}>({s.tier})</span></div>
                <div style={{ fontSize: 11, color: "#9490A8" }}>
                  Deliverables: {s.deliverable_completion_pct !== null ? `${s.deliverable_completion_pct}%` : "—"} complete
                  {s.conversion_rate_pct !== null ? ` · Conversion: ${s.conversion_rate_pct}%` : ""}
                  {s.at_risk_deliverables > 0 ? ` · ${s.at_risk_deliverables} at risk` : ""}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ==================== Incident Analytics ====================
function IncidentAnalyticsTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => { apiGet("/incidents/analytics").then(setData).catch((err) => setError(err.message)); }, []);

  const doExport = async () => {
    setExporting(true);
    try { await exportIncidentReportPdf(); } catch (err) { setError(err.message); } finally { setExporting(false); }
  };

  if (error) return <div style={{ fontSize: 13, color: "#C23A5B", background: "#FDE7EC", padding: "10px 14px", borderRadius: 10 }}>{error}</div>;
  if (!data) return <div style={{ fontSize: 13, color: "#9490A8" }}>Loading…</div>;

  const bySeverityData = data.open_by_severity.map((s) => ({ name: s.severity, value: parseInt(s.count, 10) }));
  const byTypeData = data.by_type.map((t) => ({ name: t.incident_type.replace(/_/g, " "), value: parseInt(t.count, 10) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
        <StatBox icon={Clock} label="Avg. Resolution Time" value={data.avg_resolution_minutes !== null ? `${data.avg_resolution_minutes} min` : "—"} />
        <StatBox icon={AlertTriangle} label="Escalations Logged" value={data.escalation_count} />
        <button onClick={doExport} disabled={exporting} style={{ background: "#fff", border: `1px solid ${PURPLE}`, color: PURPLE, padding: "0 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          <Download size={14} /> {exporting ? "Exporting…" : "Export Report"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 10 }}>Open Incidents by Severity</div>
          {bySeverityData.length === 0 ? (
            <div style={{ fontSize: 12, color: "#B0ACC4" }}>No open incidents.</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={bySeverityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0EEF8" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9490A8" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9490A8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E3E0F1" }} />
                <Bar dataKey="value" fill={PURPLE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 10 }}>Incidents by Type</div>
          {byTypeData.length === 0 ? (
            <div style={{ fontSize: 12, color: "#B0ACC4" }}>No incidents logged yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={byTypeData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F0EEF8" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#9490A8" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: "#4B4768" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E3E0F1" }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {byTypeData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 4 }}>Workflow History</div>
        <div style={{ fontSize: 11, color: "#9490A8", marginBottom: 12 }}>Every status change and escalation, most recent first.</div>
        {data.workflow_history.length === 0 ? (
          <div style={{ fontSize: 12, color: "#B0ACC4" }}>No workflow actions logged yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.workflow_history.map((h) => (
              <div key={h.log_id} style={{ padding: "8px 10px", borderRadius: 10, background: "#F9F8FD" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{h.title}</div>
                <div style={{ fontSize: 11, color: "#9490A8" }}>
                  {h.from_status || "new"} → {h.to_status} · {h.action} · {h.actor} · {new Date(h.created_at).toLocaleString()}
                </div>
                {h.notes && <div style={{ fontSize: 11, color: "#6D4CF0", fontStyle: "italic", marginTop: 2 }}>{h.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
