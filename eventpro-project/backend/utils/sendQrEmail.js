import { transporter, isEmailConfigured } from "../config/mailer.js";


export async function sendRegistrationEmail({ to, name, eventTitle, registrationId, qrCodeDataUrl }) {
  if (!isEmailConfigured()) {
    console.warn(
      `Email not sent to ${to} — SMTP_HOST/SMTP_USER/SMTP_PASS not set in .env. ` +
      `Registration still succeeded; the attendee just won't get an email.`
    );
    return { sent: false, reason: "email_not_configured" };
  }

  const base64Data = qrCodeDataUrl.split(",")[1]; 
  const cid = `qr-${registrationId}@eventpro`;

  try {
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to,
      subject: `You're registered! Your EventPro ticket — #${registrationId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#1B1533;">You're registered${eventTitle ? ` for ${eventTitle}` : ""}!</h2>
          <p>Hi ${name || "there"},</p>
          <p>Thanks for registering. Show the QR code below at check-in — it's unique to your registration.</p>
          <div style="text-align:center; margin: 24px 0;">
            <img src="cid:${cid}" alt="Your QR code" style="width:220px;height:220px;" />
          </div>
          <p style="color:#6B6580; font-size:13px;">Registration ID: #${registrationId}</p>
        </div>
      `,
      attachments: [
        {
          filename: `eventpro-ticket-${registrationId}.png`,
          content: Buffer.from(base64Data, "base64"),
          cid, 
        },
      ],
    });
    return { sent: true };
  } catch (err) {
    console.error(`Failed to send registration email to ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
}