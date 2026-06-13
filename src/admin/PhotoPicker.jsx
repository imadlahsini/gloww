import React, { useState } from "react";
import { styles } from "./styles.js";
import { uploadPhoto, IMGBB_KEY } from "./api.js";

export default function PhotoPicker({ value, onChange, label = "Photo" }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await uploadPhoto(file);
      onChange(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label style={styles.label}>{label}</label>
      <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ ...styles.thumb, width: "64px", height: "64px", display: "inline-block", backgroundImage: value ? `url(${value})` : "none", backgroundSize: "cover", backgroundPosition: "center" }} />
        {IMGBB_KEY ? (
          <label style={{ ...styles.pricePill, padding: "10px 14px", cursor: "pointer" }}>
            <input type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: "none" }} />
            {uploading ? "Envoi…" : "Changer la photo"}
          </label>
        ) : null}
      </div>
      {!IMGBB_KEY && (
        <input style={styles.input} value={value || ""} placeholder="Lien de l'image" onChange={(e) => onChange(e.target.value)} />
      )}
      {error && <p style={{ color: "#f87171", fontSize: "13px", margin: "6px 0 0" }}>{error}</p>}
    </div>
  );
}
