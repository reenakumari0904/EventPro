import { query } from "../config/db.js";
import QRCode from "qrcode";
import { sendRegistrationEmail } from "../utils/sendQrEmail.js";

// POST /event/register
export async function registerForEvent(req, res) {
  try {
    const { user_id, event_id, ticket_type, source } = req.body;

    const result = await query(
      `INSERT INTO registrations (user_id, event_id, ticket_type, source)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id, event_id, ticket_type || "Standard", source || "Website"]
    );

    const registration = result.rows[0];
    const qrData = `REG-${registration.registration_id}`;
    const qrCode = await QRCode.toDataURL(qrData);

    await query(`UPDATE registrations SET qr_code = $1 WHERE registration_id = $2`, [
      qrCode,
      registration.registration_id,
    ]);

    // Look up the attendee's email/name and the event title so the email
    // can be personalized. This runs after the registration is already
    // saved, so an email failure never blocks a successful registration.
    const userResult = await query(`SELECT name, email FROM users WHERE user_id = $1`, [user_id]);
    const eventResult = await query(`SELECT title FROM events WHERE event_id = $1`, [event_id]);
    const user = userResult.rows[0];
    const event = eventResult.rows[0];

    let emailResult = { sent: false, reason: "no_user_found" };
    if (user) {
      emailResult = await sendRegistrationEmail({
        to: user.email,
        name: user.name,
        eventTitle: event?.title,
        registrationId: registration.registration_id,
        qrCodeDataUrl: qrCode,
      });
    }

    res.status(201).json({ ...registration, qr_code: qrCode, email_sent: emailResult.sent });
  } catch (err) {
    console.error("POST /event/register error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// GET /attendees
export async function getAttendees(req, res) {
  try {
    const result = await query(
      `SELECT r.registration_id, u.name, u.email, r.ticket_type, r.source, r.status,
              r.qr_code, c.checkin_time
       FROM registrations r
       JOIN users u ON u.user_id = r.user_id
       LEFT JOIN checkins c ON c.registration_id = r.registration_id
       ORDER BY r.registration_date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PUT /registration/status
export async function updateRegistrationStatus(req, res) {
  try {
    const { registration_id, status } = req.body;
    const result = await query(
      `UPDATE registrations SET status = $1 WHERE registration_id = $2 RETURNING *`,
      [status, registration_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}