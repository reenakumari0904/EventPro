import React, { useState } from "react";
import { Sparkles, LogIn, UserPlus } from "lucide-react";
import { PURPLE, NAVY, BG } from "./theme";
import { API_BASE, setToken } from "./api";

// Shown when there's no valid admin session yet. On success, calls
// onLoggedIn(token) so the parent can re-render into the real dashboard.
export default function AdminAuthPage({ onLoggedIn }) {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [form, setForm] = useState({ name: "", email: "", password: "", invite_code: "" });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      if (mode === "login") {
        const res = await fetch(`${API_BASE}/admin/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Login failed");
        setToken(data.token);
        onLoggedIn();
      } else {
        const res = await fetch(`${API_BASE}/admin/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Signup failed");
        // Auto-login right after successful signup.
        const loginRes = await fetch(`${API_BASE}/admin/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
        const loginData = await loginRes.json();
        if (!loginRes.ok) throw new Error(loginData.error || "Login after signup failed");
        setToken(loginData.token);
        onLoggedIn();
      }
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ width: 380, background: "#fff", borderRadius: 16, padding: 32, boxShadow: "0 4px 24px rgba(27,21,51,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: PURPLE, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={17} color="#fff" />
          </div>
          <span style={{ fontSize: 19, fontWeight: 700, color: NAVY }}>EventPro Admin</span>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20, background: BG, borderRadius: 10, padding: 4 }}>
          <button
            onClick={() => { setMode("login"); setError(""); }}
            style={{
              flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
              background: mode === "login" ? "#fff" : "transparent",
              color: mode === "login" ? PURPLE : "#8B87A0",
              boxShadow: mode === "login" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}
          >
            Log In
          </button>
          <button
            onClick={() => { setMode("signup"); setError(""); }}
            style={{
              flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
              background: mode === "signup" ? "#fff" : "transparent",
              color: mode === "signup" ? PURPLE : "#8B87A0",
              boxShadow: mode === "signup" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div style={{ background: "#FDE7EC", color: "#C23A5B", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && (
            <Field label="Full Name" value={form.name} onChange={update("name")} required />
          )}
          <Field label="Email" type="email" value={form.email} onChange={update("email")} required />
          <Field label="Password" type="password" value={form.password} onChange={update("password")} required />
          {mode === "signup" && (
            <Field
              label="Admin Invite Code"
              value={form.invite_code}
              onChange={update("invite_code")}
              required
              hint="Ask whoever set up the project for this code (ADMIN_SIGNUP_CODE in backend/.env)."
            />
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: PURPLE, color: "#fff", border: "none", padding: "11px 16px",
              borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 4,
              opacity: status === "loading" ? 0.7 : 1,
            }}
          >
            {mode === "login" ? <LogIn size={16} /> : <UserPlus size={16} />}
            {status === "loading" ? "Please wait..." : mode === "login" ? "Log In" : "Create Admin Account"}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 12, color: "#8B87A0", display: "block", marginBottom: 6 };
const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E3E0F1",
  fontSize: 13, outline: "none", boxSizing: "border-box",
};

function Field({ label, hint, required, ...props }) {
  return (
    <div>
      <label style={labelStyle}>
        {label} {required && <span style={{ color: "#F0678E" }}>*</span>}
      </label>
      <input required={required} style={inputStyle} {...props} />
      {hint && <div style={{ fontSize: 10.5, color: "#B0ACC4", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}