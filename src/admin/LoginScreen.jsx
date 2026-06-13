import React from "react";
import { styles } from "./styles.js";

export default function LoginScreen({ password, setPassword, onLogin, loggingIn }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#000",
        color: "#fff",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        padding: "calc(24px + env(safe-area-inset-top, 0px)) 20px calc(24px + env(safe-area-inset-bottom, 0px))",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          margin: "auto",
          padding: "28px 24px",
          borderRadius: "24px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxSizing: "border-box",
        }}
      >
        <span style={{ display: "block", fontSize: "11px", letterSpacing: "1.8px", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>
          Administration
        </span>
        <h1 style={{ fontSize: "28px", lineHeight: 1.1, margin: "10px 0 8px" }}>Glow Beauty</h1>
        <p style={{ fontSize: "14px", lineHeight: 1.5, color: "rgba(255,255,255,0.58)", margin: "0 0 24px" }}>
          Connectez-vous pour gerer le menu.
        </p>

        <label htmlFor="admin-password" style={styles.label}>Mot de passe</label>
        <input
          id="admin-password"
          className="admin-input"
          type="password"
          value={password}
          disabled={loggingIn}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onLogin()}
          placeholder="Mot de passe"
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          style={{ ...styles.input, marginBottom: "16px", opacity: loggingIn ? 0.5 : 1, cursor: loggingIn ? "not-allowed" : "text" }}
        />

        <button
          type="button"
          className="admin-btn"
          onClick={onLogin}
          disabled={loggingIn}
          aria-busy={loggingIn}
          style={{ ...styles.primaryBtn, minHeight: "52px", opacity: loggingIn ? 0.45 : 1, cursor: loggingIn ? "not-allowed" : "pointer" }}
        >
          {loggingIn ? "Connexion..." : "Connexion"}
        </button>
      </div>
    </div>
  );
}
