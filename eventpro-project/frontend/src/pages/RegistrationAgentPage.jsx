import React, { useState } from "react";
import { Bot, Send, CheckCircle2, Link2, Copy, Check } from "lucide-react";
import Card from "../components/Card";
import { PURPLE, NAVY, BG } from "../theme";
import { apiPost } from "../api";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  organization: "",
  city: "",
  country: "",
  gender: "",
  age: "",
  interest: "",
  ticket_type: "Standard",
};

export default function RegistrationAgentPage({ eventId = 1, standalone = false }) {
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("idle"); 
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const registrationLink = `${window.location.origin}/register?event=${eventId}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(registrationLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setStatus("saving");
    setErrorMsg("");
    try {
      
      const user = await apiPost("/register", form);

      const registration = await apiPost("/event/register", {
        user_id: user.user_id,
        event_id: eventId,
        ticket_type: form.ticket_type,
        source: standalone ?  "Registration Link" : "Admin Dashboard",
      });

      setResult(registration);
      setStatus("success");
      setForm(emptyForm);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      {!standalone && (
        <Card style={{ maxWidth: 620, margin: "0 auto 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Link2 size={16} color={PURPLE} />
            <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>Share Registration Link</div>
          </div>
          <div style={{ fontSize: 12, color: "#9490A8", marginBottom: 12 }}>
            Send this link to attendees — anyone who opens it can register themselves without needing
            access to this dashboard.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              readOnly
              value={registrationLink}
              onFocus={(e) => e.target.select()}
              style={{ ...inputStyle, flex: 1, background: BG, color: NAVY, fontFamily: "monospace", fontSize: 12 }}
            />
            <button
              onClick={copyLink}
              style={{
                display: "flex", alignItems: "center", gap: 6, background: copied ? "#2FC59B" : PURPLE,
                color: "#fff", border: "none", padding: "0 16px", borderRadius: 10, fontSize: 12,
                fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy Link"}
            </button>
          </div>
        </Card>
      )}

      <Card style={{ maxWidth: 620, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div
            style={{
              width: 54, height: 54, borderRadius: "50%", background: "#EDE7FF",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <Bot size={28} color={PURPLE} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>
              {standalone ? "Register for the Event" : "Register an Attendee"}
            </div>
            <div style={{ fontSize: 12, color: "#9490A8" }}>
              {standalone
                ? "Fill in your details below to reserve your spot."
                : "This form saves directly to your database via the backend API."}
            </div>
          </div>
        </div>

        {status === "success" && (
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10, background: "#E3FBF3",
              color: "#1E9C74", padding: "12px 16px", borderRadius: 12, marginBottom: 16, fontSize: 13,
            }}
          >
            <CheckCircle2 size={18} />
            Registered successfully. Registration ID: {result?.registration_id}
          </div>
        )}
        {status === "error" && (
          <div
            style={{
              background: "#FDE7EC", color: "#C23A5B", padding: "12px 16px",
              borderRadius: 12, marginBottom: 16, fontSize: 13,
            }}
          >
            {errorMsg || "Something went wrong. Is the backend running on localhost:5000?"}
          </div>
        )}

        <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Full Name" value={form.name} onChange={update("name")} required />
          <Field label="Email" type="email" value={form.email} onChange={update("email")} required />
          <Field label="Phone" value={form.phone} onChange={update("phone")} />
          <Field label="Organization" value={form.organization} onChange={update("organization")} />
          <Field label="City" value={form.city} onChange={update("city")} />
          <Field label="Country" value={form.country} onChange={update("country")} />
          <div>
            <label style={labelStyle}>Gender</label>
            <select value={form.gender} onChange={update("gender")} style={inputStyle}>
              <option value="">Prefer not to say</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </div>
          <Field label="Age" type="number" min="1" max="120" value={form.age} onChange={update("age")} />
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Area of Interest</label>
            <select value={form.interest} onChange={update("interest")} style={inputStyle}>
              <option value="">None selected</option>
              <option>AI & ML</option>
              <option>Web Dev</option>
              <option>Data Science</option>
              <option>Cybersecurity</option>
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Ticket Type</label>
            <select value={form.ticket_type} onChange={update("ticket_type")} style={inputStyle}>
              <option>Standard</option>
              <option>VIP</option>
              <option>Student</option>
              <option>Others</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={status === "saving"}
            style={{
              gridColumn: "1 / -1", background: PURPLE, color: "#fff", border: "none",
              padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600,
              cursor: status === "saving" ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              opacity: status === "saving" ? 0.7 : 1,
            }}
          >
            <Send size={16} />
            {status === "saving" ? "Saving..." : "Register Attendee"}
          </button>
        </form>
      </Card>
    </div>
  );
}

const labelStyle = { fontSize: 12, color: "#8B87A0", display: "block", marginBottom: 6 };
const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E3E0F1",
  fontSize: 13, outline: "none", boxSizing: "border-box",
};

function Field({ label, required, ...props }) {
  return (
    <div>
      <label style={labelStyle}>
        {label} {required && <span style={{ color: "#F0678E" }}>*</span>}
      </label>
      <input required={required} style={inputStyle} {...props} />
    </div>
  );
}