import React, { useEffect, useState } from "react";
import { styles } from "./styles.js";
import { callAdmin, loadData } from "./api.js";
import LoginScreen from "./LoginScreen.jsx";
import MenuEditor from "./MenuEditor.jsx";

export default function AdminApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [password, setPassword] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authenticated || data) return;
    let cancelled = false;
    loadData()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [authenticated, data]);

  async function handleLogin() {
    if (loggingIn || !password) return;
    setLoggingIn(true);
    setError("");
    try {
      await callAdmin({ action: "login", password });
      setAuthenticated(true);
    } catch (e) {
      setError(e.message || "Mot de passe incorrect.");
    } finally {
      setLoggingIn(false);
    }
  }

  if (!authenticated) {
    return (
      <>
        <LoginScreen password={password} setPassword={setPassword} onLogin={handleLogin} loggingIn={loggingIn} />
        {error && <p style={{ position: "fixed", top: "16px", left: "16px", right: "16px", textAlign: "center", color: "#f87171" }}>{error}</p>}
      </>
    );
  }

  if (error && !data) {
    return (
      <div style={{ ...styles.container, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center" }}>
        <div>
          <p style={{ color: "#f87171", marginBottom: "16px" }}>{error}</p>
          <button type="button" style={styles.primaryBtn} onClick={() => { setError(""); setData(null); }}>Réessayer</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div style={{ ...styles.container, display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "rgba(255,255,255,0.5)" }}>Chargement…</p></div>;
  }

  return <MenuEditor initialData={data} password={password} />;
}
