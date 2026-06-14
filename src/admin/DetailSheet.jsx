import React, { useState, useRef, useEffect } from "react";
import { styles } from "./styles.js";
import PhotoPicker, { AddPhotoTile } from "./PhotoPicker.jsx";
import { galleryImages } from "./data.js";

const moveToFront = (arr, i) => [arr[i], ...arr.filter((_, j) => j !== i)];

// Two-tap delete: the × becomes "Confirmer ?" for ~3s, since the undo toast
// is hidden while a sheet is open.
function RemoveButton({ onConfirm }) {
  const [confirm, setConfirm] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  function handleClick() {
    if (confirm) {
      onConfirm();
      return;
    }
    setConfirm(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setConfirm(false), 3000);
  }
  return (
    <button type="button" onClick={handleClick} style={confirm ? styles.removeBtnConfirm : styles.removeBtn} aria-label="Supprimer la photo">
      {confirm ? "Confirmer ?" : "✕"}
    </button>
  );
}

function GalleryItem({ url, isCover, onMakeCover, onRemove }) {
  return (
    <div style={styles.galleryItem(isCover)}>
      <span style={{ ...styles.galleryThumb, backgroundImage: `url(${url})` }} />
      {isCover ? (
        <span style={styles.coverBadge}>Couverture</span>
      ) : (
        <button type="button" onClick={onMakeCover} style={styles.coverBtn} aria-label="Définir comme couverture">★</button>
      )}
      <RemoveButton onConfirm={onRemove} />
    </div>
  );
}

export default function DetailSheet({ target, onChange, onDelete, onClose, onSetImages }) {
  if (!target) return null;

  if (target.type === "service") {
    const s = target.service;
    const gallery = galleryImages(s);
    return (
      <div style={styles.sheetBackdrop} onClick={onClose}>
        <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
          <div style={styles.grabber} />
          <label style={styles.label}>Photos</label>
          <div style={styles.galleryStrip}>
            {gallery.map((url, i) => (
              <GalleryItem
                key={url + "#" + i}
                url={url}
                isCover={i === 0}
                onMakeCover={() => onSetImages(moveToFront(gallery, i))}
                onRemove={() => onSetImages(gallery.filter((_, j) => j !== i))}
              />
            ))}
            <AddPhotoTile onAdd={(url) => onSetImages([...gallery, url])} />
          </div>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", margin: "0 0 4px" }}>
            La 1re photo est la couverture. Touchez ★ pour la changer.
          </p>
          <label style={styles.label}>Nom</label>
          <input style={styles.input} value={s.name} onChange={(e) => onChange({ name: e.target.value })} />
          <label style={styles.label}>Prix (DH)</label>
          <input style={styles.input} type="number" inputMode="numeric" value={s.price}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") return onChange({ price: 0 });
              const n = Number(raw);
              if (Number.isFinite(n)) onChange({ price: n });
            }} />
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
