import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PublicRegisterPage from "./PublicRegisterPage";
import "./index.css";

// Simple path-based routing without a router library: the shared
// registration link points at /register, everything else is the
// internal admin dashboard.
const isPublicRegisterRoute = window.location.pathname.startsWith("/register");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isPublicRegisterRoute ? <PublicRegisterPage /> : <App />}
  </React.StrictMode>
);