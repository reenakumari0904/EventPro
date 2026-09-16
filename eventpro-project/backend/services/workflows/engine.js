
import { incrementCounter } from "../../utils/metrics.js";

const workflows = new Map(); 
const runs = new Map(); 
const MAX_RUNS_KEPT = 200;

let nextRunId = 1;

export function defineWorkflow(name, steps) {
  workflows.set(name, steps);
}

export function listWorkflows() {
  return Array.from(workflows.entries()).map(([name, steps]) => ({
    name,
    steps: steps.map((s) => ({ name: s.name, agent: s.agent, requires_approval: !!s.requiresApproval })),
  }));
}

export function getRun(id) {
  return runs.get(String(id)) || null;
}

export function listRuns({ status, workflow } = {}) {
  let all = Array.from(runs.values());
  if (status) all = all.filter((r) => r.status === status);
  if (workflow) all = all.filter((r) => r.workflow_name === workflow);
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function newRun(workflowName, steps, initialContext, triggeredBy) {
  const id = String(nextRunId++);
  const run = {
    id,
    workflow_name: workflowName,
    status: "running",
    context: { ...initialContext, runId: id, triggeredBy },
    steps: steps.map((s) => ({ name: s.name, agent: s.agent, status: "pending", started_at: null, ended_at: null, output: null, error: null })),
    current_step_index: 0,
    pending_approval: null, 
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  runs.set(id, run);
  if (runs.size > MAX_RUNS_KEPT) {
    const finished = listRuns().filter((r) => r.status === "completed" || r.status === "failed" || r.status === "rejected");
    for (const r of finished.slice(MAX_RUNS_KEPT)) runs.delete(r.id);
  }
  return run;
}

async function executeFrom(run, steps, startIndex, options = {}) {
  const result = await executeFromInner(run, steps, startIndex, options);
  if (result.status !== "running") {
    incrementCounter("workflow_runs_total", { workflow: result.workflow_name, status: result.status });
  }
  return result;
}

async function executeFromInner(run, steps, startIndex, { resuming = false, approvalDecision = null } = {}) {
  for (let i = startIndex; i < steps.length; i++) {
    const step = steps[i];
    const stepRecord = run.steps[i];
    run.current_step_index = i;

    const needsApproval = typeof step.requiresApproval === "function" ? step.requiresApproval(run.context) : false;
    if (needsApproval && !(resuming && i === startIndex)) {
      stepRecord.status = "awaiting_approval";
      run.status = "awaiting_approval";
      run.pending_approval = { step_index: i, prompt: step.approvalPrompt ? step.approvalPrompt(run.context) : `Approval required for step "${step.name}".` };
      run.updated_at = new Date().toISOString();
      return run;
    }

    if (resuming && i === startIndex && needsApproval) {
      if (approvalDecision.approved) {
        stepRecord.approved_by = approvalDecision.decidedBy || "admin";
        stepRecord.approval_note = approvalDecision.note || null;
      } else {
        stepRecord.status = "rejected";
        stepRecord.ended_at = new Date().toISOString();
        run.status = "rejected";
        run.pending_approval = null;
        run.updated_at = new Date().toISOString();
        try {
          await step.onReject?.({ ...run.context, decidedBy: approvalDecision.decidedBy, note: approvalDecision.note });
        } catch (rejectErr) {
          console.error(`Workflow ${run.workflow_name} run ${run.id}: onReject hook for step "${step.name}" failed:`, rejectErr.message);
        }
        return run;
      }
    }

    stepRecord.status = "running";
    stepRecord.started_at = new Date().toISOString();
    try {
      const output = await step.run(run.context, run);
      Object.assign(run.context, output || {});
      stepRecord.status = "ok";
      stepRecord.output = output || null;
    } catch (err) {
      stepRecord.status = "error";
      stepRecord.error = err.message;
      console.error(`Workflow ${run.workflow_name} run ${run.id}: step "${step.name}" failed:`, err.message);
      if (step.onError !== "continue") {
        stepRecord.ended_at = new Date().toISOString();
        run.status = "failed";
        run.updated_at = new Date().toISOString();
        return run;
      }
    }
    stepRecord.ended_at = new Date().toISOString();
  }

  run.status = "completed";
  run.pending_approval = null;
  run.updated_at = new Date().toISOString();
  return run;
}
export async function startWorkflow(name, initialContext = {}, { triggeredBy } = {}) {
  const steps = workflows.get(name);
  if (!steps) throw new Error(`No workflow registered as "${name}".`);
  const run = newRun(name, steps, initialContext, triggeredBy);
  return executeFrom(run, steps, 0);
}
export async function resumeWorkflow(runId, { approved, decidedBy, note } = {}) {
  const run = getRun(runId);
  if (!run) {
    const err = new Error(`No workflow run with id "${runId}".`);
    err.status = 404;
    throw err;
  }
  if (run.status !== "awaiting_approval") {
    const err = new Error(`Run ${runId} is not awaiting approval (current status: ${run.status}).`);
    err.status = 409;
    throw err;
  }
  const steps = workflows.get(run.workflow_name);
  run.status = "running";
  return executeFrom(run, steps, run.pending_approval.step_index, { resuming: true, approvalDecision: { approved, decidedBy, note } });
}

export function _resetForTests() {
  runs.clear();
  nextRunId = 1;
}
