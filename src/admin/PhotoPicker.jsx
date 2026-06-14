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

// A square tile that APPENDS a photo to a gallery (vs PhotoPicker which replaces one).
// Uses ImgBB upload when configured; otherwise a small "paste a link" flow.
export function AddPhotoTile({ onAdd }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [urlMode, setUrlMode] = useState(false);
  const [url, setUrl] = useState("");

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      onAdd(await uploadPhoto(file));
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  function submitUrl() {
    const u = url.trim();
    if (!u) return;
    onAdd(u);
    setUrl("");
    setUrlMode(false);
  }

  if (IMGBB_KEY) {
    return (
      <label style={styles.addTile} aria-label="Ajouter une photo" title={error || ""}>
        <input type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: "none" }} />
        <span style={{ fontSize: "26px", lineHeight: 1 }}>{uploading ? "…" : "+"}</span>
      </label>
    );
  }

  if (urlMode) {
    return (
      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
        <input
          autoFocus
          style={{ ...styles.input, marginBottom: 0, width: "170px" }}
          value={url}
          placeholder="Lien de l'image"
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitUrl()}
        />
        <button type="button" style={{ ...styles.primaryBtn, width: "auto", minHeight: "44px", padding: "0 16px" }} onClick={submitUrl}>OK</button>
      </div>
    );
  }

  return (
    <button type="button" style={styles.addTile} onClick={() => setUrlMode(true)} aria-label="Ajouter une photo">
      <span style={{ fontSize: "26px", lineHeight: 1 }}>+</span>
    </button>
  );
}
