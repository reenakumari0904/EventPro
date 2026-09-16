import { query } from "../config/db.js";

// GET /dashboard
export async function getDashboardStats(req, res) {
  try {
    const total = await query(`SELECT COUNT(*) FROM registrations`);
    const checkedIn = await query(`SELECT COUNT(*) FROM checkins WHERE checkin_time IS NOT NULL`);
    const cancelled = await query(`SELECT COUNT(*) FROM registrations WHERE status = 'Cancelled'`);
    const waitlisted = await query(`SELECT COUNT(*) FROM registrations WHERE status = 'Waitlisted'`);
    const confirmed = await query(
      `SELECT COUNT(*) FROM registrations WHERE status NOT IN ('Cancelled', 'Waitlisted')`
    );

    const totalCount = parseInt(total.rows[0].count, 10);
    const checkedInCount = parseInt(checkedIn.rows[0].count, 10);

    res.json({
      total_registrations: totalCount,
      checked_in: checkedInCount,
      pending_checkin: totalCount - checkedInCount,
      cancelled: parseInt(cancelled.rows[0].count, 10),
      waitlisted: parseInt(waitlisted.rows[0].count, 10),
      confirmed_registrations: parseInt(confirmed.rows[0].count, 10),
    });
  } catch (err) {
    console.error("GET /dashboard error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// GET /analytics
export async function getAnalytics(req, res) {
  try {
    const byTicketType = await query(
      `SELECT ticket_type, COUNT(*) FROM registrations GROUP BY ticket_type`
    );
    const bySource = await query(
      `SELECT source, COUNT(*) FROM registrations GROUP BY source`
    );
    const trend = await query(
      `SELECT TO_CHAR(registration_date, 'Mon DD') AS day, COUNT(*) AS value
       FROM registrations
       GROUP BY day, DATE(registration_date)
       ORDER BY DATE(registration_date) ASC`
    );

    const byGender = await query(
      `SELECT u.gender, COUNT(DISTINCT r.registration_id)
       FROM registrations r
       JOIN users u ON u.user_id = r.user_id
       WHERE u.gender IS NOT NULL AND u.gender <> ''
       GROUP BY u.gender`
    );

    const byAgeGroup = await query(
      `SELECT
         CASE
           WHEN u.age < 18 THEN '<18'
           WHEN u.age BETWEEN 18 AND 24 THEN '18-24'
           WHEN u.age BETWEEN 25 AND 34 THEN '25-34'
           WHEN u.age BETWEEN 35 AND 44 THEN '35-44'
           ELSE '45+'
         END AS name,
         COUNT(DISTINCT r.registration_id) AS value
       FROM registrations r
       JOIN users u ON u.user_id = r.user_id
       WHERE u.age IS NOT NULL
       GROUP BY 1`
    );

    const byInterest = await query(
      `SELECT u.interest, COUNT(DISTINCT r.registration_id) AS count
       FROM registrations r
       JOIN users u ON u.user_id = r.user_id
       WHERE u.interest IS NOT NULL AND u.interest <> ''
       GROUP BY u.interest
       ORDER BY count DESC
       LIMIT 5`
    );

    res.json({
      by_ticket_type: byTicketType.rows,
      by_source: bySource.rows,
      trend: trend.rows,
      by_gender: byGender.rows,
      by_age_group: byAgeGroup.rows,
      by_interest: byInterest.rows,
    });
  } catch (err) {
    console.error("GET /analytics error:", err.message);
    res.status(500).json({ error: err.message });
  }
}