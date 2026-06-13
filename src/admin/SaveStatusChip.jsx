import React from "react";
import { styles } from "./styles.js";

const LABELS = {
  idle: { text: "", color: "rgba(255,255,255,0.4)" },
  saving: { text: "Enregistrement…", color: "rgba(255,255,255,0.55)" },
  saved: { text: "Enregistré", color: "#22c55e" },
  error: { text: "Échec — touchez pour réessayer", color: "#f87171" },
};

export default function SaveStatusChip({ status, onRetry }) {
  const label = LABELS[status] || LABELS.idle;
  if (!label.text) return null;
  return (
    <button
      type="button"
      onClick={status === "error" ? onRetry : undefined}
      style={{ ...styles.chip, color: label.color, background: "transparent", border: "none", cursor: status === "error" ? "pointer" : "default" }}
    >
      {label.text}
    </button>
  );
}
