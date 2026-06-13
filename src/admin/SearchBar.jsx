import React from "react";
import { styles } from "./styles.js";

export default function SearchBar({ value, onChange }) {
  return (
    <div style={styles.search}>
      <span aria-hidden="true" style={{ color: "rgba(255,255,255,0.45)" }}>⌕</span>
      <input
        style={styles.searchInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rechercher un soin…"
        aria-label="Rechercher un soin"
        autoCapitalize="none"
        autoCorrect="off"
      />
      {value && (
        <button type="button" aria-label="Effacer" onClick={() => onChange("")} style={{ border: "none", background: "transparent", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>✕</button>
      )}
    </div>
  );
}
