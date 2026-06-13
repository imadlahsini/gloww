import React from "react";
import { styles } from "./styles.js";

export default function CategoryHeader({ category, count, collapsed, visible, onToggleCollapse, onToggleVisible, onEdit }) {
  return (
    <div style={{ ...styles.catHeader, opacity: visible ? 1 : 0.5 }}>
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        style={{ border: "none", background: "transparent", color: "inherit", font: "inherit", textTransform: "inherit", letterSpacing: "inherit", cursor: "pointer", flex: 1, textAlign: "left", padding: 0, textDecoration: visible ? "none" : "line-through" }}
      >
        {collapsed ? "▸" : "▾"} {category.name} · {count}
      </button>
      <button type="button" onClick={onEdit} aria-label={`Modifier la categorie ${category.name}`} style={{ border: "none", background: "transparent", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "15px" }}>
        ✎
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={visible}
        aria-label={`Visible: ${category.name}`}
        onClick={onToggleVisible}
        style={{ ...styles.toggle, background: visible ? "#22c55e" : "rgba(255,255,255,0.12)" }}
      >
        <span style={{ ...styles.toggleKnob, transform: visible ? "translateX(18px)" : "translateX(0)" }} />
      </button>
    </div>
  );
}
