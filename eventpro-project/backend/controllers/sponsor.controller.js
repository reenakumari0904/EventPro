import { query } from "../config/db.js";
export async function createSponsor(req, res) {
  try {
    const { name, tier, contact_name, contact_email, contract_amount, payment_status, contract_start_date, contract_end_date, contract_notes } = req.body;
    if (!name) return res.status(400).json({ error: "name is required." });
    const result = await query(
      `INSERT INTO sponsors (name, tier, contact_name, contact_email, contract_amount, payment_status, contract_start_date, contract_end_date, contract_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, tier || null, contact_name || null, contact_email || null, contract_amount || null, payment_status || "pending",
       contract_start_date || null, contract_end_date || null, contract_notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /sponsors error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
export async function getSponsors(req, res) {
  try {
    const result = await query(`SELECT * FROM sponsors ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateSponsor(req, res) {
  try {
    const { id } = req.params;
    const { name, tier, contact_name, contact_email, contract_amount, payment_status, contract_start_date, contract_end_date, contract_notes } = req.body;
    const result = await query(
      `UPDATE sponsors SET name = $1, tier = $2, contact_name = $3, contact_email = $4, contract_amount = $5, payment_status = $6,
              contract_start_date = $7, contract_end_date = $8, contract_notes = $9
       WHERE sponsor_id = $10 RETURNING *`,
      [name, tier || null, contact_name || null, contact_email || null, contract_amount || null, payment_status || "pending",
       contract_start_date || null, contract_end_date || null, contract_notes || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Sponsor not found." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /sponsors/:id error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
export async function deleteSponsor(req, res) {
  try {
    const { id } = req.params;
    const inUse = await query(`SELECT deliverable_id FROM sponsor_deliverables WHERE sponsor_id = $1 LIMIT 1`, [id]);
    if (inUse.rows.length > 0) {
      return res.status(409).json({ error: "Can't delete a sponsor that has deliverables on file. Remove those first." });
    }
    const result = await query(`DELETE FROM sponsors WHERE sponsor_id = $1 RETURNING sponsor_id`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Sponsor not found." });
    res.json({ deleted: true });
  } catch (err) {
    console.error("DELETE /sponsors/:id error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// POST /sponsors/:id/deliverables
export async function createDeliverable(req, res) {
  try {
    const { id } = req.params;
    const { description, deliverable_type, due_date, spec_dimensions, spec_format } = req.body;
    if (!description) return res.status(400).json({ error: "description is required." });
  
    const approvalStatus = deliverable_type === "branding" ? "pending_approval" : "not_required";
    const result = await query(
      `INSERT INTO sponsor_deliverables (sponsor_id, description, deliverable_type, due_date, spec_dimensions, spec_format, approval_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, description, deliverable_type || "other", due_date || null, spec_dimensions || null, spec_format || null, approvalStatus]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /sponsors/:id/deliverables error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

export async function updateDeliverableApproval(req, res) {
  try {
    const { deliverableId } = req.params;
    const { approval_status } = req.body;
    if (!["not_required", "pending_approval", "approved", "rejected"].includes(approval_status)) {
      return res.status(400).json({ error: "approval_status must be one of: not_required, pending_approval, approved, rejected." });
    }
    const result = await query(
      `UPDATE sponsor_deliverables SET approval_status = $1 WHERE deliverable_id = $2 RETURNING *`,
      [approval_status, deliverableId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Deliverable not found." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /sponsors/deliverables/:deliverableId/approval error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// GET /sponsors/deliverables — optionally ?sponsor_id=
export async function getDeliverables(req, res) {
  try {
    const { sponsor_id } = req.query;
    const result = sponsor_id
      ? await query(
          `SELECT d.*, s.name AS sponsor_name FROM sponsor_deliverables d
           JOIN sponsors s ON s.sponsor_id = d.sponsor_id
           WHERE d.sponsor_id = $1 ORDER BY d.due_date ASC NULLS LAST`,
          [sponsor_id]
        )
      : await query(
          `SELECT d.*, s.name AS sponsor_name FROM sponsor_deliverables d
           JOIN sponsors s ON s.sponsor_id = d.sponsor_id
           ORDER BY d.due_date ASC NULLS LAST`
        );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PUT /sponsors/deliverables/:deliverableId — mark completed / at_risk / pending
export async function updateDeliverableStatus(req, res) {
  try {
    const { deliverableId } = req.params;
    const { status } = req.body;
    if (!["pending", "completed", "at_risk"].includes(status)) {
      return res.status(400).json({ error: "status must be one of: pending, completed, at_risk." });
    }
    const result = await query(
      `UPDATE sponsor_deliverables SET status = $1, completed_at = CASE WHEN $3 = 'completed' THEN NOW() ELSE NULL END
       WHERE deliverable_id = $2 RETURNING *`,
      [status, deliverableId, status]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Deliverable not found." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /sponsors/deliverables/:deliverableId error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// POST /sponsors/:id/engagement — log a single engagement event
// (booth visit, lead, conversion, session participation, social mention, promo activity).
export async function recordEngagement(req, res) {
  try {
    const { id } = req.params;
    const { metric_type, metric_value, notes } = req.body;
    if (!metric_type) return res.status(400).json({ error: "metric_type is required." });
    const result = await query(
      `INSERT INTO sponsor_engagement (sponsor_id, metric_type, metric_value, notes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, metric_type, metric_value || 1, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /sponsors/:id/engagement error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// GET /sponsors/analytics — Sponsor Performance Analytics dashboard.
export async function getSponsorAnalytics(req, res) {
  try {
    const overview = await query(
      `SELECT s.sponsor_id, s.name, s.tier, s.contract_amount, s.payment_status,
              COUNT(DISTINCT d.deliverable_id) AS total_deliverables,
              COUNT(DISTINCT d.deliverable_id) FILTER (WHERE d.status = 'completed') AS completed_deliverables,
              COUNT(DISTINCT d.deliverable_id) FILTER (WHERE d.status = 'at_risk' OR (d.status = 'pending' AND d.due_date < CURRENT_DATE)) AS at_risk_deliverables,
              COALESCE(SUM(e.metric_value) FILTER (WHERE e.metric_type = 'lead'), 0) AS leads_generated,
              COALESCE(SUM(e.metric_value) FILTER (WHERE e.metric_type = 'conversion'), 0) AS conversions,
              COALESCE(COUNT(e.engagement_id), 0) AS total_engagement_events
       FROM sponsors s
       LEFT JOIN sponsor_deliverables d ON d.sponsor_id = s.sponsor_id
       LEFT JOIN sponsor_engagement e ON e.sponsor_id = s.sponsor_id
       GROUP BY s.sponsor_id, s.name, s.tier, s.contract_amount, s.payment_status
       ORDER BY total_engagement_events DESC`
    );

    const engagementByType = await query(
      `SELECT metric_type, COUNT(*) AS event_count, SUM(metric_value) AS total_value
       FROM sponsor_engagement GROUP BY metric_type ORDER BY total_value DESC`
    );

    const atRiskSponsors = overview.rows.filter((s) => parseInt(s.at_risk_deliverables, 10) > 0);
    const topEngaged = overview.rows[0] || null;

    const rows = overview.rows.map((s) => {
      const leads = parseInt(s.leads_generated, 10);
      const conversions = parseInt(s.conversions, 10);
      const totalDeliverables = parseInt(s.total_deliverables, 10);
      const completed = parseInt(s.completed_deliverables, 10);
      return {
        ...s,
        deliverable_completion_pct: totalDeliverables > 0 ? Math.round((completed / totalDeliverables) * 100) : null,
        conversion_rate_pct: leads > 0 ? Math.round((conversions / leads) * 100) : null,
        // Illustrative ROI proxy — engagement events per ₹1,000 of contract value.
        engagement_per_1000: s.contract_amount > 0 ? Math.round((s.total_engagement_events / (s.contract_amount / 1000)) * 100) / 100 : null,
      };
    });

    res.json({
      sponsors: rows,
      engagement_by_type: engagementByType.rows,
      at_risk_sponsors: atRiskSponsors.map((s) => ({ sponsor_id: s.sponsor_id, name: s.name, at_risk_deliverables: s.at_risk_deliverables })),
      top_engaged_sponsor: topEngaged ? { sponsor_id: topEngaged.sponsor_id, name: topEngaged.name, total_engagement_events: topEngaged.total_engagement_events } : null,
    });
  } catch (err) {
    console.error("GET /sponsors/analytics error:", err.message);
    res.status(500).json({ error: err.message });
  }
}


export async function aiSponsorInsights(req, res) {
  try {
    const { question } = req.body || {};

    const pendingDeliverables = await query(
      `SELECT s.name AS sponsor_name, d.description, d.due_date
       FROM sponsor_deliverables d JOIN sponsors s ON s.sponsor_id = d.sponsor_id
       WHERE d.status = 'pending' ORDER BY d.due_date ASC NULLS LAST`
    );
    const engagementRanking = await query(
      `SELECT s.sponsor_id, s.name, COALESCE(SUM(e.metric_value), 0) AS total_engagement
       FROM sponsors s LEFT JOIN sponsor_engagement e ON e.sponsor_id = s.sponsor_id
       GROUP BY s.sponsor_id, s.name ORDER BY total_engagement DESC LIMIT 1`
    );
    const atRisk = await query(
      `SELECT s.name AS sponsor_name, d.description, d.due_date
       FROM sponsor_deliverables d JOIN sponsors s ON s.sponsor_id = d.sponsor_id
       WHERE d.status = 'at_risk' OR (d.status = 'pending' AND d.due_date < CURRENT_DATE)`
    );

    const ruleBasedAnswers = {
      pending_deliverables: pendingDeliverables.rows,
      highest_engagement_sponsor: engagementRanking.rows[0] || null,
      at_risk_sponsors: atRisk.rows,
    };

    let aiAnswer = null;
    if (question && process.env.GEMINI_API_KEY) {
      const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
      const context = {
        pending_deliverables: pendingDeliverables.rows,
        engagement_ranking: engagementRanking.rows,
        at_risk: atRisk.rows,
      };
      const prompt =
        "You are an event coordinator's assistant analyzing live sponsor data. Answer the question " +
        "briefly (2-4 sentences) using only the data provided — don't invent sponsors or numbers not in it.\n\n" +
        `Question: "${question}"\n\nSponsor data:\n${JSON.stringify(context, null, 2)}`;

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
        );
        if (response.ok) {
          const data = await response.json();
          aiAnswer = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
        }
      } catch (aiErr) {
        console.warn("Sponsor AI insight request failed:", aiErr.message);
      }
    }

    res.json({ ...ruleBasedAnswers, question: question || null, ai_answer: aiAnswer });
  } catch (err) {
    console.error("POST /sponsors/ai-insights error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

async function recalculatePaymentStatus(sponsorId) {
  const sponsorRow = await query(`SELECT contract_amount FROM sponsors WHERE sponsor_id = $1`, [sponsorId]);
  const contractAmount = parseFloat(sponsorRow.rows[0]?.contract_amount || 0);
  const totalRow = await query(`SELECT COALESCE(SUM(amount), 0) AS total FROM sponsor_payments WHERE sponsor_id = $1`, [sponsorId]);
  const totalPaid = parseFloat(totalRow.rows[0].total);

  let status = "pending";
  if (contractAmount > 0 && totalPaid >= contractAmount) status = "paid";
  else if (totalPaid > 0) status = "partial";

  await query(`UPDATE sponsors SET payment_status = $1 WHERE sponsor_id = $2`, [status, sponsorId]);
  return { totalPaid, contractAmount, status };
}
export async function recordPayment(req, res) {
  try {
    const { id } = req.params;
    const { amount, payment_date, method, notes } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: "amount must be a positive number." });

    const result = await query(
      `INSERT INTO sponsor_payments (sponsor_id, amount, payment_date, method, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, amount, payment_date || null, method || "other", notes || null]
    );
    const { totalPaid, contractAmount, status } = await recalculatePaymentStatus(id);

    res.status(201).json({ payment: result.rows[0], total_paid: totalPaid, contract_amount: contractAmount, payment_status: status });
  } catch (err) {
    console.error("POST /sponsors/:id/payments error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// GET /sponsors/payments — optionally ?sponsor_id=
export async function getPayments(req, res) {
  try {
    const { sponsor_id } = req.query;
    const result = sponsor_id
      ? await query(
          `SELECT p.*, s.name AS sponsor_name FROM sponsor_payments p
           JOIN sponsors s ON s.sponsor_id = p.sponsor_id
           WHERE p.sponsor_id = $1 ORDER BY p.payment_date DESC`,
          [sponsor_id]
        )
      : await query(
          `SELECT p.*, s.name AS sponsor_name FROM sponsor_payments p
           JOIN sponsors s ON s.sponsor_id = p.sponsor_id
           ORDER BY p.payment_date DESC`
        );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
export async function createPackage(req, res) {
  try {
    const { name, tier, description, items } = req.body;
    if (!name) return res.status(400).json({ error: "name is required." });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items must be a non-empty array of { description, deliverable_type }." });
    }

    const packageRow = await query(
      `INSERT INTO sponsorship_packages (name, tier, description) VALUES ($1, $2, $3) RETURNING *`,
      [name, tier || null, description || null]
    );
    const pkg = packageRow.rows[0];

    const insertedItems = [];
    for (const item of items) {
      if (!item.description) continue;
      const itemRow = await query(
        `INSERT INTO sponsorship_package_items (package_id, description, deliverable_type) VALUES ($1, $2, $3) RETURNING *`,
        [pkg.package_id, item.description, item.deliverable_type || "other"]
      );
      insertedItems.push(itemRow.rows[0]);
    }

    res.status(201).json({ ...pkg, items: insertedItems });
  } catch (err) {
    console.error("POST /sponsorship-packages error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// GET /sponsorship-packages — each package with its items grouped in.
export async function getPackages(req, res) {
  try {
    const packages = await query(`SELECT * FROM sponsorship_packages ORDER BY created_at DESC`);
    const items = await query(`SELECT * FROM sponsorship_package_items ORDER BY item_id ASC`);
    const grouped = packages.rows.map((p) => ({
      ...p,
      items: items.rows.filter((i) => i.package_id === p.package_id),
    }));
    res.json(grouped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
export async function assignPackageToSponsor(req, res) {
  try {
    const { id } = req.params;
    const { package_id, due_date } = req.body;
    if (!package_id) return res.status(400).json({ error: "package_id is required." });

    const itemsRow = await query(`SELECT * FROM sponsorship_package_items WHERE package_id = $1`, [package_id]);
    if (itemsRow.rows.length === 0) return res.status(404).json({ error: "Package not found or has no items." });

    const created = [];
    for (const item of itemsRow.rows) {
      const approvalStatus = item.deliverable_type === "branding" ? "pending_approval" : "not_required";
      const inserted = await query(
        `INSERT INTO sponsor_deliverables (sponsor_id, description, deliverable_type, due_date, approval_status)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [id, item.description, item.deliverable_type, due_date || null, approvalStatus]
      );
      created.push(inserted.rows[0]);
    }

    res.status(201).json({ created, count: created.length });
  } catch (err) {
    console.error("POST /sponsors/:id/assign-package error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
