import { query } from "../config/db.js";

// POST /checkin
export async function checkInAttendee(req, res) {
  try {
    const { registration_id, gate, device } = req.body;

    const result = await query(
      `INSERT INTO checkins (registration_id, checkin_time, gate, device)
       VALUES ($1, NOW(), $2, $3) RETURNING *`,
      [registration_id, gate, device]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /dashboard (live check-in counts)
export async function getCheckinSummary(req, res) {
  try {
    const totalRegistered = await query(`SELECT COUNT(*) FROM registrations`);
    const totalCheckedIn = await query(`SELECT COUNT(*) FROM checkins WHERE checkin_time IS NOT NULL`);

    const registered = parseInt(totalRegistered.rows[0].count, 10);
    const checkedIn = parseInt(totalCheckedIn.rows[0].count, 10);

    res.json({
      registered,
      checked_in: checkedIn,
      remaining: registered - checkedIn,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
