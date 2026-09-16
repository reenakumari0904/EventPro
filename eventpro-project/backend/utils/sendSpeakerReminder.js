import { transporter, isEmailConfigured } from "../config/mailer.js";
export async function sendSpeakerReminder({ to, speakerName, sessionTitle, venueName, startTime, endTime }) {
  if (!isEmailConfigured()) {
    console.warn(`Speaker reminder not sent to ${to} — SMTP not configured in .env.`);
    return { sent: false, reason: "email_not_configured" };
  }

  try {
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to,
      subject: `Session assignment: "${sessionTitle}"`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#1B1533;">You've been scheduled to speak</h2>
          <p>Hi ${speakerName || "there"},</p>
          <p>You've been assigned to the following session:</p>
          <div style="background:#F5F4FA; border-radius:10px; padding:14px 18px; margin: 16px 0;">
            <p style="margin:0 0 6px; font-weight:bold; color:#1B1533;">${sessionTitle}</p>
            <p style="margin:0; font-size:13px; color:#6B6580;">
              ${venueName ? `Venue: ${venueName}<br/>` : ""}
              ${new Date(startTime).toLocaleString()} &rarr; ${new Date(endTime).toLocaleString()}
            </p>
          </div>
          <p style="color:#6B6580; font-size:13px;">If this time doesn't work for you, please reply to this email as soon as possible.</p>
        </div>
      `,
    });
    return { sent: true };
  } catch (err) {
    console.error(`Failed to send speaker reminder to ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

export async function sendScheduleUpdateNotice({ to, speakerName, sessionTitle, venueName, previousStartTime, newStartTime, newEndTime }) {
  if (!isEmailConfigured()) {
    console.warn(`Schedule update notice not sent to ${to} — SMTP not configured in .env.`);
    return { sent: false, reason: "email_not_configured" };
  }

  try {
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to,
      subject: `Schedule change: "${sessionTitle}"`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#1B1533;">Your session time has changed</h2>
          <p>Hi ${speakerName || "there"},</p>
          <p>The schedule for your session has been updated:</p>
          <div style="background:#F5F4FA; border-radius:10px; padding:14px 18px; margin: 16px 0;">
            <p style="margin:0 0 6px; font-weight:bold; color:#1B1533;">${sessionTitle}</p>
            ${previousStartTime ? `<p style="margin:0 0 6px; font-size:12px; color:#B0ACC4; text-decoration:line-through;">Previously: ${new Date(previousStartTime).toLocaleString()}</p>` : ""}
            <p style="margin:0; font-size:13px; color:#6B6580;">
              ${venueName ? `Venue: ${venueName}<br/>` : ""}
              New time: ${new Date(newStartTime).toLocaleString()} &rarr; ${new Date(newEndTime).toLocaleString()}
            </p>
          </div>
          <p style="color:#6B6580; font-size:13px;">If this new time doesn't work for you, please reply to this email as soon as possible.</p>
        </div>
      `,
    });
    return { sent: true };
  } catch (err) {
    console.error(`Failed to send schedule update notice to ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
}