import React from "react";
import { styles } from "./styles.js";

export default function CategoryHeader({ category, count, collapsed, onToggleCollapse, onEdit }) {
  return (
    <div style={styles.catHeader}>
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        style={{ border: "none", background: "transparent", color: "inherit", font: "inherit", textTransform: "inherit", letterSpacing: "inherit", cursor: "pointer", flex: 1, textAlign: "left", padding: 0 }}
      >
        {collapsed ? "▸" : "▾"} {category.name} · {count}
      </button>
      <button type="button" onClick={onEdit} aria-label={`Modifier la categorie ${category.name}`} style={{ border: "none", background: "transparent", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "15px" }}>
        ✎
      </button>
    </div>
  );
}
