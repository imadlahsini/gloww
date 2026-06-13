import React from "react";
import { styles } from "./styles.js";

export default function LoginScreen({ password, setPassword, onLogin, loggingIn }) {
  return (
    <div style={styles.container}>
      <div style={{ width: "min(100%, 460px)", margin: "max(32px, 10vh) auto", padding: "28px" }}>
        <span style={{ fontSize: "11px", letterSpacing: "1.8px", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>Administration</span>
        <h1 style={{ fontSize: "30px", margin: "8px 0 8px" }}>Glow Beauty</h1>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.58)", marginBottom: "24px" }}>Connectez-vous pour gerer le menu.</p>
        <label style={styles.label}>Mot de passe</label>
        <input
          type="password"
          value={password}
          autoFocus
          disabled={loggingIn}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onLogin()}
          style={{ ...styles.input, marginBottom: "16px" }}
          placeholder="Mot de passe"
        />
        <button type="button" onClick={onLogin} disabled={loggingIn} style={{ ...styles.primaryBtn, opacity: loggingIn ? 0.6 : 1 }}>
          {loggingIn ? "Connexion..." : "Connexion"}
        </button>
      </div>
    </div>
  );
}
