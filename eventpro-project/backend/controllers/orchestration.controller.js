import { runOrchestration } from "../services/orchestrator.js";
import { AGENT_REGISTRY } from "../services/agents.js";
export function listAgents(req, res) {
  res.json({
    agents: AGENT_REGISTRY.map((a) => ({ name: a.name, description: a.description })),
  });
}

export async function runOnce(req, res) {
  try {
    const generateAlerts = req.query.generateAlerts === "true";
    const report = await runOrchestration({ generateAlerts, useCache: !generateAlerts });
    res.json(report);
  } catch (err) {
    console.error("GET /orchestration/run error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

export async function streamOrchestration(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", 
  });
  res.flushHeaders?.();

  const intervalMs = Math.min(Math.max(parseInt(req.query.intervalMs, 10) || 8000, 3000), 60000);
  let closed = false;

  const sendReport = async () => {
    if (closed) return;
    try {
      const report = await runOrchestration({ generateAlerts: false, useCache: true });
      res.write(`event: report\ndata: ${JSON.stringify(report)}\n\n`);
    } catch (err) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    }
  };

  await sendReport(); 
  const timer = setInterval(sendReport, intervalMs);
  const heartbeat = setInterval(() => { if (!closed) res.write(`: heartbeat\n\n`); }, 15000);

  req.on("close", () => {
    closed = true;
    clearInterval(timer);
    clearInterval(heartbeat);
    res.end();
  });
}
