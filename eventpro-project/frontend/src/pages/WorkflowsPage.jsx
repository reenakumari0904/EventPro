import React, { useState, useEffect, useCallback } from "react";
import {
  GitBranch, PlayCircle, CheckCircle2, XCircle, Clock, AlertTriangle,
  ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import Card from "../components/Card";
import { PURPLE, NAVY } from "../theme";
import { apiGet, apiPost } from "../api";

const STATUS_STYLE = {
  running: { color: "#B08900", bg: "#FFF8DE", label: "Running", icon: Loader2 },
  awaiting_approval: { color: "#7C5CFC", bg: "#F0EEF8", label: "Awaiting approval", icon: Clock },
  completed: { color: "#3D7A5C", bg: "#E7F6EE", label: "Completed", icon: CheckCircle2 },
  failed: { color: "#C23A5B", bg: "#FDE7EC", label: "Failed", icon: XCircle },
  rejected: { color: "#9490A8", bg: "#F0EEF8", label: "Rejected", icon: XCircle },
};

const STEP_STATUS_STYLE = {
  pending: { color: "#B0ACC4", bg: "#F5F4FA" },
  running: { color: "#B08900", bg: "#FFF8DE" },
  ok: { color: "#3D7A5C", bg: "#E7F6EE" },
  error: { color: "#C23A5B", bg: "#FDE7EC" },
  awaiting_approval: { color: "#7C5CFC", bg: "#F0EEF8" },
  rejected: { color: "#9490A8", bg: "#F0EEF8" },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.running;
  const Icon = s.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, padding: "4px 10px", borderRadius: 999 }}>
      <Icon size={12} className={status === "running" ? "spin" : ""} /> {s.label}
    </span>
  );
}

function RunTimeline({ run }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
      {run.steps.map((step, idx) => {
        const s = STEP_STATUS_STYLE[step.status] || STEP_STATUS_STYLE.pending;
        return (
          <div key={step.name} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12 }}>
            <span style={{ minWidth: 18, textAlign: "center", color: "#B0ACC4", fontWeight: 700 }}>{idx + 1}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700, color: NAVY }}>{step.name}</span>
                <span style={{ fontSize: 9, color: "#9490A8", textTransform: "uppercase" }}>{step.agent}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: s.color, background: s.bg, padding: "2px 7px", borderRadius: 999, textTransform: "uppercase" }}>{step.status}</span>
              </div>
              {step.error && <div style={{ color: "#C23A5B", fontSize: 11, marginTop: 2 }}>{step.error}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RunCard({ run, onDecision }) {
  const [expanded, setExpanded] = useState(run.status === "awaiting_approval");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const decide = async (approved) => {
    setBusy(true);
    try {
      await onDecision(run.id, approved, note);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ border: "1px solid #EDEBF7", borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setExpanded((e) => !e)}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <GitBranch size={15} color={PURPLE} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: NAVY }}>{run.workflow_name} · run #{run.id}</div>
            <div style={{ fontSize: 11, color: "#9490A8" }}>{new Date(run.created_at).toLocaleString()}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StatusBadge status={run.status} />
          {expanded ? <ChevronUp size={16} color="#B0ACC4" /> : <ChevronDown size={16} color="#B0ACC4" />}
        </div>
      </div>

      {expanded && (
        <>
          <RunTimeline run={run} />
          {run.status === "awaiting_approval" && (
            <div style={{ marginTop: 12, padding: 12, background: "#F9F8FD", borderRadius: 10 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 12, color: NAVY, fontWeight: 600, marginBottom: 8 }}>
                <AlertTriangle size={14} color={PURPLE} style={{ marginTop: 1, flexShrink: 0 }} />
                {run.pending_approval?.prompt}
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note (visible in the incident log)…"
                rows={2}
                style={{ width: "100%", fontSize: 12, borderRadius: 8, border: "1px solid #EDEBF7", padding: 8, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button disabled={busy} onClick={() => decide(true)} style={{ flex: 1, background: "#3D7A5C", color: "#fff", border: "none", borderRadius: 8, padding: "8px 0", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
                  Approve
                </button>
                <button disabled={busy} onClick={() => decide(false)} style={{ flex: 1, background: "#FDE7EC", color: "#C23A5B", border: "none", borderRadius: 8, padding: "8px 0", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
                  Reject
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Milestone 3 — reactive Agent Orchestration. Lets an admin trigger any of
// the four scenario workflows and make the human-approval decisions they
// pause on. See docs/AGENT_ORCHESTRATION.md for each chain.
const WORKFLOWS = {
  "speaker-cancellation": {
    label: "Speaker Cancellation",
    description: "Speaker Agent detects the cancellation → Intelligence Engine analyzes impact → Venue Agent checks alternatives → Registration System identifies affected attendees → Incident Agent creates (and auto-escalates) an incident → Alert → admin approves/rejects a proposed venue swap → dashboard refreshes.",
    fields: [
      { key: "session_id", label: "Session ID", type: "number", required: true },
      { key: "reason", label: "Reason (optional)", type: "text" },
    ],
  },
  "sponsor-performance": {
    label: "Sponsor Performance",
    description: "Sponsor data → engagement tracking → lead calculation → conversion rate → ROI indicator → dashboard. Flags Platinum/Gold sponsors with poor ROI as an incident for account-manager follow-up.",
    fields: [{ key: "sponsor_id", label: "Sponsor ID", type: "number", required: true }],
  },
  "venue-issue": {
    label: "Venue Issue",
    description: "Venue issue → Incident Agent classifies severity → team assignment → alert → work begins → admin confirms resolution before the incident closes.",
    fields: [
      { key: "venue_id", label: "Venue ID", type: "number", required: true },
      { key: "issue_type", label: "Issue type", type: "select", options: ["power_outage", "structural", "av_failure", "hvac", "cleanliness", "other"] },
      { key: "description", label: "Description (optional)", type: "text" },
    ],
  },
  "high-crowd": {
    label: "High Crowd Detection",
    description: "Registration/check-in data → Intelligence Engine capacity analysis → risk detection → operational alert → a concrete recommended action. Advisory only — no approval gate.",
    fields: [{ key: "venue_id", label: "Venue ID", type: "number", required: true }],
  },
};

export default function WorkflowsPage() {
  const [workflowKey, setWorkflowKey] = useState("speaker-cancellation");
  const [formValues, setFormValues] = useState({});
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState("");
  const [runs, setRuns] = useState(null);
  const [loadingRuns, setLoadingRuns] = useState(true);

  const activeWorkflow = WORKFLOWS[workflowKey];

  const loadRuns = useCallback(async () => {
    try {
      const data = await apiGet("/workflows/runs");
      setRuns(data.runs);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  useEffect(() => {
    loadRuns();
    const interval = setInterval(loadRuns, 6000);
    return () => clearInterval(interval);
  }, [loadRuns]);

  const setField = (key, value) => setFormValues((v) => ({ ...v, [key]: value }));

  const trigger = async () => {
    const missing = activeWorkflow.fields.find((f) => f.required && !formValues[f.key]);
    if (missing) { setError(`${missing.label} is required.`); return; }
    setTriggering(true);
    setError("");
    try {
      const payload = {};
      for (const f of activeWorkflow.fields) {
        if (formValues[f.key] === undefined || formValues[f.key] === "") continue;
        payload[f.key] = f.type === "number" ? Number(formValues[f.key]) : formValues[f.key];
      }
      await apiPost(`/workflows/${workflowKey}`, payload);
      setFormValues({});
      await loadRuns();
    } catch (e) {
      setError(e.message);
    } finally {
      setTriggering(false);
    }
  };

  const handleDecision = async (runId, approved, note) => {
    try {
      await apiPost(`/workflows/runs/${runId}/${approved ? "approve" : "reject"}`, { note: note || undefined });
      await loadRuns();
    } catch (e) {
      setError(e.message);
    }
  };

  const pendingCount = runs?.filter((r) => r.status === "awaiting_approval").length || 0;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
          <PlayCircle size={16} color={PURPLE} /> Trigger a Reactive Workflow
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {Object.entries(WORKFLOWS).map(([key, wf]) => (
            <button
              key={key}
              onClick={() => { setWorkflowKey(key); setFormValues({}); setError(""); }}
              style={{
                fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 999, cursor: "pointer",
                border: key === workflowKey ? `1.5px solid ${PURPLE}` : "1px solid #EDEBF7",
                background: key === workflowKey ? "#F0EEF8" : "#fff",
                color: key === workflowKey ? PURPLE : "#8B87A0",
              }}
            >
              {wf.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12, color: "#9490A8", marginBottom: 14 }}>{activeWorkflow.description}</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {activeWorkflow.fields.map((f) =>
            f.type === "select" ? (
              <select
                key={f.key}
                value={formValues[f.key] || ""}
                onChange={(e) => setField(f.key, e.target.value)}
                style={{ fontSize: 13, borderRadius: 8, border: "1px solid #EDEBF7", padding: "8px 10px" }}
              >
                <option value="">{f.label}</option>
                {f.options.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
              </select>
            ) : (
              <input
                key={f.key}
                type={f.type}
                value={formValues[f.key] || ""}
                onChange={(e) => setField(f.key, e.target.value)}
                placeholder={f.label}
                style={{ width: f.type === "number" ? 140 : 220, fontSize: 13, borderRadius: 8, border: "1px solid #EDEBF7", padding: "8px 10px" }}
              />
            )
          )}
          <button
            onClick={trigger}
            disabled={triggering}
            style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: triggering ? 0.6 : 1 }}
          >
            {triggering ? "Running…" : "Trigger workflow"}
          </button>
        </div>
        {error && <div style={{ fontSize: 12, color: "#C23A5B", marginTop: 10 }}>{error}</div>}
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: NAVY }}>Workflow Runs</div>
          {pendingCount > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#7C5CFC", background: "#F0EEF8", padding: "4px 10px", borderRadius: 999 }}>
              {pendingCount} awaiting your approval
            </span>
          )}
        </div>
        {loadingRuns ? (
          <div style={{ fontSize: 12, color: "#9490A8" }}>Loading…</div>
        ) : !runs?.length ? (
          <div style={{ fontSize: 12, color: "#B0ACC4" }}>No workflow runs yet — trigger one above.</div>
        ) : (
          runs.map((run) => <RunCard key={run.id} run={run} onDecision={handleDecision} />)
        )}
      </Card>
    </div>
  );
}
