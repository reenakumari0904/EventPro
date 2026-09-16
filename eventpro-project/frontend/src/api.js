// Central place for talking to the backend.
// Reads VITE_API_BASE at build time (see frontend/Dockerfile and
// docs/DEPLOYMENT.md) so the same build works across environments without
// editing source; falls back to localhost for local `npm run dev`.
export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

const TOKEN_KEY = "eventpro_admin_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// If the backend says our session is invalid/expired, log out and reload
// so the person lands back on the admin login screen automatically.
function handleAuthFailure(status) {
  if (status === 401) {
    clearToken();
    window.location.reload();
  }
}

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { ...authHeaders() } });
  if (!res.ok) {
    handleAuthFailure(res.status);
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `GET ${path} failed: ${res.status}`);
  }
  return res.json();
}

export async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    handleAuthFailure(res.status);
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `POST ${path} failed: ${res.status}`);
  }
  return res.json();
}

export async function apiPut(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    handleAuthFailure(res.status);
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `PUT ${path} failed: ${res.status}`);
  }
  return res.json();
}

// Opens a Server-Sent Events connection for real-time decision support
// (see backend /api/orchestration/stream). EventSource can't set an
// Authorization header, so the JWT travels as a query param instead.
// Returns a close() function; call it on component unmount.
export function apiStream(path, { onReport, onError, intervalMs } = {}) {
  const token = getToken();
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (intervalMs) params.set("intervalMs", String(intervalMs));
  const url = `${API_BASE}${path}?${params.toString()}`;

  const source = new EventSource(url);
  source.addEventListener("report", (evt) => {
    try {
      onReport?.(JSON.parse(evt.data));
    } catch {
      onError?.(new Error("Received a malformed update from the server."));
    }
  });
  source.addEventListener("error", (evt) => {
    // A generic EventSource "error" event (e.g. connection drop) has no
    // .data; a server-sent `event: error` payload does.
    if (evt.data) {
      try {
        onError?.(new Error(JSON.parse(evt.data).error));
        return;
      } catch { /* fall through to generic handling below */ }
    }
    onError?.(new Error("Live connection interrupted — retrying…"));
  });

  return () => source.close();
}

export async function apiDelete(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    handleAuthFailure(res.status);
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `DELETE ${path} failed: ${res.status}`);
  }
  return res.json();
}
