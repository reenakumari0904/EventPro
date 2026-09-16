import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { CameraOff } from "lucide-react";
import { PURPLE } from "../theme";

const TEXT_LIGHT = "#8B87A0";

const ELEMENT_ID = "qr-camera-region";

// Opens the device camera and scans for a real QR code. Calls onScan(text)
// once per successful decode. The parent is responsible for stopping
// duplicate scans (e.g. by debouncing check-ins already in progress).
export default function QrScanner({ onScan, onError }) {
  const scannerRef = useRef(null);
  const [active, setActive] = useState(false);
  const [camError, setCamError] = useState("");

  useEffect(() => {
    return () => {
      // Clean up the camera stream if the component unmounts while active.
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const start = async () => {
    setCamError("");
    try {
      const html5Qr = new Html5Qrcode(ELEMENT_ID);
      scannerRef.current = html5Qr;
      await html5Qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          onScan(decodedText);
        },
        () => {
          // fires continuously while no code is found — ignore
        }
      );
      setActive(true);
    } catch (err) {
      setCamError(err?.message || "Could not access camera.");
      onError?.(err?.message);
    }
  };

  const stop = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        // ignore stop errors (e.g. already stopped)
      }
    }
    setActive(false);
  };

  return (
    <div style={{ width: "100%" }}>
      <div
        id={ELEMENT_ID}
        style={{
          width: "100%",
          minHeight: active ? 260 : 0,
          borderRadius: 12,
          overflow: "hidden",
          background: active ? "#000" : "transparent",
        }}
      />
      {camError && (
        <div style={{ fontSize: 12, color: "#C23A5B", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <CameraOff size={14} /> {camError} — you can still use the manual list below.
        </div>
      )}
      <button
        onClick={active ? stop : start}
        style={{
          marginTop: 10, width: "100%", background: active ? "#FDE7EC" : PURPLE,
          color: active ? "#C23A5B" : "#fff", border: "none", padding: "10px 16px",
          borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}
      >
        {active ? "Stop Camera" : "Scan QR Code with Camera"}
      </button>
      {!active && (
        <div style={{ fontSize: 11, color: TEXT_LIGHT, marginTop: 6, textAlign: "center" }}>
          Requires camera permission in your browser.
        </div>
      )}
    </div>
  );
}