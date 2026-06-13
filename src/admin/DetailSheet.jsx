import React from "react";
import { styles } from "./styles.js";
import PhotoPicker from "./PhotoPicker.jsx";

export default function DetailSheet({ target, onChange, onDelete, onClose }) {
  if (!target) return null;

  if (target.type === "service") {
    const s = target.service;
    return (
      <div style={styles.sheetBackdrop} onClick={onClose}>
        <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
          <div style={styles.grabber} />
          <PhotoPicker value={s.image} onChange={(url) => onChange({ image: url })} />
          <label style={styles.label}>Nom</label>
          <input style={styles.input} value={s.name} onChange={(e) => onChange({ name: e.target.value })} />
          <label style={styles.label}>Prix (DH)</label>
          <input style={styles.input} type="number" inputMode="numeric" value={s.price}
            onChange={(e) => onChange({ price: e.target.value === "" ? 0 : Number(e.target.value) })} />
          <label style={styles.label}>Durée</label>
          <input style={styles.input} value={s.duration} onChange={(e) => onChange({ duration: e.target.value })} />
          <label style={styles.label}>Description</label>
          <textarea style={{ ...styles.input, minHeight: "96px" }} value={s.description || ""} onChange={(e) => onChange({ description: e.target.value })} />
          <button type="button" style={styles.dangerBtn} onClick={onDelete}>Supprimer ce soin</button>
          <button type="button" style={{ ...styles.primaryBtn, marginTop: "10px" }} onClick={onClose}>Terminé</button>
        </div>
      </div>
    );
  }

  const c = target.category;
  return (
    <div style={styles.sheetBackdrop} onClick={onClose}>
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.grabber} />
        <PhotoPicker value={c.image} onChange={(url) => onChange({ image: url })} label="Icône" />
        <PhotoPicker value={c.heroImage} onChange={(url) => onChange({ heroImage: url })} label="Bannière" />
        <label style={styles.label}>Nom de la catégorie</label>
        <input style={styles.input} value={c.name} onChange={(e) => onChange({ name: e.target.value })} />
        <button type="button" style={styles.dangerBtn} onClick={onDelete}>Supprimer cette catégorie</button>
        <button type="button" style={{ ...styles.primaryBtn, marginTop: "10px" }} onClick={onClose}>Terminé</button>
      </div>
    </div>
  );
}
