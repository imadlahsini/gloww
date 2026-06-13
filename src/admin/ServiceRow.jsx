import React from "react";
import { styles } from "./styles.js";

export default function ServiceRow({ service, onToggle, onOpen }) {
  const visible = service.visible !== false;
  return (
    <div style={{ ...styles.row, opacity: visible ? 1 : 0.45 }}>
      <button type="button" onClick={onOpen} style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer" }} aria-label={`Modifier ${service.name}`}>
        {service.image ? (
          <img src={service.image} alt="" style={styles.thumb} />
        ) : (
          <span style={{ ...styles.thumb, display: "inline-block" }} />
        )}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ ...styles.rowName, textDecoration: visible ? "none" : "line-through" }}>{service.name}</p>
        <button type="button" style={styles.pricePill} onClick={onOpen}>
          {service.price} DH
        </button>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={visible}
        aria-label={`Visible: ${service.name}`}
        onClick={onToggle}
        style={{ ...styles.toggle, background: visible ? "#22c55e" : "rgba(255,255,255,0.12)" }}
      >
        <span style={{ ...styles.toggleKnob, transform: visible ? "translateX(18px)" : "translateX(0)" }} />
      </button>
    </div>
  );
}
