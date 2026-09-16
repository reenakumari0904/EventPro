import { jest } from "@jest/globals";

// Pure engine tests — no DB, no real workflow definitions. This proves the
// engine's mechanics (sequencing, context passing, error policies,
// approval pause/resume, rejection hooks) independent of any one workflow.

const { defineWorkflow, startWorkflow, resumeWorkflow, getRun, listRuns, _resetForTests } =
  await import("../services/workflows/engine.js");

describe("Workflow Engine", () => {
  beforeEach(() => _resetForTests());

  it("runs steps in order, passing context forward", async () => {
    const order = [];
    defineWorkflow("simple-chain", [
      { name: "a", agent: "agent-a", run: async () => { order.push("a"); return { valueFromA: 1 }; } },
      { name: "b", agent: "agent-b", run: async (ctx) => { order.push("b"); return { valueFromB: ctx.valueFromA + 1 }; } },
      { name: "c", agent: "agent-c", run: async (ctx) => { order.push("c"); return { total: ctx.valueFromA + ctx.valueFromB }; } },
    ]);

    const run = await startWorkflow("simple-chain", {});
    expect(order).toEqual(["a", "b", "c"]);
    expect(run.status).toBe("completed");
    expect(run.context.total).toBe(3);
    expect(run.steps.every((s) => s.status === "ok")).toBe(true);
  });

  it("aborts the whole run when a step's onError is 'abort'", async () => {
    defineWorkflow("abort-chain", [
      { name: "a", agent: "agent-a", onError: "abort", run: async () => { throw new Error("boom"); } },
      { name: "b", agent: "agent-b", run: async () => ({ reached: true }) },
    ]);

    const run = await startWorkflow("abort-chain", {});
    expect(run.status).toBe("failed");
    expect(run.steps[0].status).toBe("error");
    expect(run.steps[0].error).toMatch(/boom/);
    expect(run.steps[1].status).toBe("pending"); // never reached
    expect(run.context.reached).toBeUndefined();
  });

  it("keeps going when a step's onError is 'continue'", async () => {
    defineWorkflow("continue-chain", [
      { name: "a", agent: "agent-a", onError: "continue", run: async () => { throw new Error("minor failure"); } },
      { name: "b", agent: "agent-b", run: async () => ({ reached: true }) },
    ]);

    const run = await startWorkflow("continue-chain", {});
    expect(run.status).toBe("completed");
    expect(run.steps[0].status).toBe("error");
    expect(run.steps[1].status).toBe("ok");
    expect(run.context.reached).toBe(true);
  });

  it("pauses for human approval and resumes on approve", async () => {
    defineWorkflow("approval-chain", [
      { name: "propose", agent: "agent-a", run: async () => ({ proposal: "swap venue" }) },
      {
        name: "confirm",
        agent: "human-approval",
        requiresApproval: () => true,
        approvalPrompt: (ctx) => `Approve: ${ctx.proposal}?`,
        run: async () => ({ executed: true }),
      },
      { name: "finish", agent: "agent-c", run: async () => ({ done: true }) },
    ]);

    const started = await startWorkflow("approval-chain", {});
    expect(started.status).toBe("awaiting_approval");
    expect(started.pending_approval.prompt).toBe("Approve: swap venue?");
    expect(started.context.executed).toBeUndefined();

    const resumed = await resumeWorkflow(started.id, { approved: true, decidedBy: "admin@example.com" });
    expect(resumed.status).toBe("completed");
    expect(resumed.context.executed).toBe(true);
    expect(resumed.context.done).toBe(true);
    expect(resumed.steps[1].approved_by).toBe("admin@example.com");
  });

  it("marks the run rejected and runs onReject when an admin rejects", async () => {
    let rejectedCtx = null;
    defineWorkflow("rejection-chain", [
      { name: "propose", agent: "agent-a", run: async () => ({ proposal: "swap venue" }) },
      {
        name: "confirm",
        agent: "human-approval",
        requiresApproval: () => true,
        run: async () => ({ executed: true }), // should never run
        onReject: async (ctx) => { rejectedCtx = ctx; },
      },
      { name: "finish", agent: "agent-c", run: async () => ({ done: true }) },
    ]);

    const started = await startWorkflow("rejection-chain", {});
    const resumed = await resumeWorkflow(started.id, { approved: false, decidedBy: "admin@example.com", note: "not now" });

    expect(resumed.status).toBe("rejected");
    expect(resumed.steps[1].status).toBe("rejected");
    expect(resumed.context.executed).toBeUndefined(); // run() for that step never executed
    expect(resumed.steps[2].status).toBe("pending"); // never reached
    expect(rejectedCtx.decidedBy).toBe("admin@example.com");
    expect(rejectedCtx.note).toBe("not now");
  });

  it("rejects resuming a run that isn't awaiting approval", async () => {
    defineWorkflow("no-approval-chain", [{ name: "a", agent: "agent-a", run: async () => ({}) }]);
    const run = await startWorkflow("no-approval-chain", {});
    expect(run.status).toBe("completed");
    await expect(resumeWorkflow(run.id, { approved: true })).rejects.toThrow(/not awaiting approval/);
  });

  it("404s on an unknown run id", async () => {
    await expect(resumeWorkflow("does-not-exist", { approved: true })).rejects.toThrow(/No workflow run/);
  });

  it("lists runs filtered by status", async () => {
    defineWorkflow("list-test-chain", [{ name: "a", agent: "agent-a", run: async () => ({}) }]);
    await startWorkflow("list-test-chain", {});
    await startWorkflow("list-test-chain", {});
    const completed = listRuns({ status: "completed", workflow: "list-test-chain" });
    expect(completed.length).toBe(2);
  });
});
