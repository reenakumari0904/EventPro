import { startWorkflow, resumeWorkflow, getRun, listRuns, listWorkflows } from "../services/workflows/engine.js";

// GET /api/workflows — what reactive workflows exist.
export function listWorkflowDefinitions(req, res) {
  res.json({ workflows: listWorkflows() });
}

// GET /api/workflows/runs — history, optionally filtered.
// ?status=awaiting_approval is how an admin finds what needs a decision.
export function getRuns(req, res) {
  const { status, workflow } = req.query;
  res.json({ runs: listRuns({ status, workflow }) });
}

// GET /api/workflows/runs/:id — full step-by-step detail for one run.
export function getRunById(req, res) {
  const run = getRun(req.params.id);
  if (!run) return res.status(404).json({ error: `No workflow run with id "${req.params.id}".` });
  res.json(run);
}

// POST /api/workflows/speaker-cancellation — trigger the chain described in
// docs/AGENT_ORCHESTRATION.md: Speaker Agent → Intelligence Engine → Venue
// Agent → Registration System → Incident Agent → Alert → [human approval]
// → Dashboard update.
export async function triggerSpeakerCancellation(req, res) {
  try {
    const { session_id, reason } = req.body;
    if (!session_id) return res.status(400).json({ error: "session_id is required." });

    const run = await startWorkflow(
      "speaker-cancellation",
      { session_id, reason },
      { triggeredBy: req.user?.email || req.user?.name || "admin" }
    );
    res.status(202).json(run);
  } catch (err) {
    console.error("POST /workflows/speaker-cancellation error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// POST /api/workflows/sponsor-performance — Sponsor data → engagement
// tracking → lead calculation → conversion rate → ROI indicator → dashboard.
export async function triggerSponsorPerformance(req, res) {
  try {
    const { sponsor_id } = req.body;
    if (!sponsor_id) return res.status(400).json({ error: "sponsor_id is required." });
    const run = await startWorkflow(
      "sponsor-performance",
      { sponsor_id },
      { triggeredBy: req.user?.email || req.user?.name || "admin" }
    );
    res.status(202).json(run);
  } catch (err) {
    console.error("POST /workflows/sponsor-performance error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// POST /api/workflows/venue-issue — Venue issue → Incident Agent →
// severity classification → team assignment → alert → [human approval] →
// resolution → closure.
export async function triggerVenueIssue(req, res) {
  try {
    const { venue_id, issue_type, description } = req.body;
    if (!venue_id) return res.status(400).json({ error: "venue_id is required." });
    const run = await startWorkflow(
      "venue-issue",
      { venue_id, issue_type, description },
      { triggeredBy: req.user?.email || req.user?.name || "admin" }
    );
    res.status(202).json(run);
  } catch (err) {
    console.error("POST /workflows/venue-issue error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// POST /api/workflows/high-crowd — Registration/check-in data →
// Intelligence Engine → capacity analysis → risk detection → operational
// alert → recommended action. No human-approval gate (advisory only).
export async function triggerHighCrowd(req, res) {
  try {
    const { venue_id } = req.body;
    if (!venue_id) return res.status(400).json({ error: "venue_id is required." });
    const run = await startWorkflow(
      "high-crowd",
      { venue_id },
      { triggeredBy: req.user?.email || req.user?.name || "admin" }
    );
    res.status(202).json(run);
  } catch (err) {
    console.error("POST /workflows/high-crowd error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// POST /api/workflows/runs/:id/approve — the human-approval gate.
export async function approveRun(req, res) {
  try {
    const run = await resumeWorkflow(req.params.id, {
      approved: true,
      decidedBy: req.user?.email || req.user?.name || "admin",
      note: req.body?.note,
    });
    res.json(run);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

// POST /api/workflows/runs/:id/reject
export async function rejectRun(req, res) {
  try {
    const run = await resumeWorkflow(req.params.id, {
      approved: false,
      decidedBy: req.user?.email || req.user?.name || "admin",
      note: req.body?.note,
    });
    res.json(run);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}
