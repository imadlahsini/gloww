import React, { useState, useRef, useEffect } from "react";
import { styles } from "./styles.js";
import { useAutosave } from "./useAutosave.js";
import * as D from "./data.js";
import SearchBar from "./SearchBar.jsx";
import CategoryHeader from "./CategoryHeader.jsx";
import ServiceRow from "./ServiceRow.jsx";
import DetailSheet from "./DetailSheet.jsx";
import SaveStatusChip from "./SaveStatusChip.jsx";

export default function MenuEditor({ initialData, password }) {
  const { data, status, mutate, undo, canUndo, retry } = useAutosave({ initialData, password });
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState({});
  const [target, setTarget] = useState(null); // {type, catId, serviceId} reference
  const [undoVisible, setUndoVisible] = useState(false);
  const undoTimerRef = useRef(null);
  useEffect(() => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }, []);

  function applyMutation(fn) {
    mutate(fn);
    setUndoVisible(true);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndoVisible(false), 5000);
  }

  const view = D.filterData(data, query);

  function openService(catId, serviceId) { setTarget({ type: "service", catId, serviceId }); }
  function openCategory(catId) { setTarget({ type: "category", catId }); }
  function closeSheet() { setTarget(null); }

  const liveCategory = target ? data.categories.find((c) => c.id === target.catId) : null;
  const liveService = target?.type === "service" && liveCategory ? (liveCategory.services || []).find((s) => s.id === target.serviceId) : null;

  function addServiceTo(catId) {
    const id = D.nextServiceId(data);
    const service = { id, name: "Nouveau soin", price: 0, duration: "1h", image: "", description: "", visible: true };
    applyMutation((d) => D.addService(d, catId, service));
    setTarget({ type: "service", catId, serviceId: id });
  }

  function addCategory() {
    const id = `cat-${Date.now()}`;
    applyMutation((d) => D.addCategory(d, { id, name: "Nouvelle catégorie", image: "", heroImage: "", visible: true, services: [] }));
    setTarget({ type: "category", catId: id });
  }

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <h1 style={styles.title}>Mes soins</h1>
        <SaveStatusChip status={status} onRetry={retry} />
      </div>

      <SearchBar value={query} onChange={setQuery} />

      {view.categories.map((cat) => (
        <div key={cat.id}>
          <CategoryHeader
            category={cat}
            count={(cat.services || []).length}
            collapsed={!!collapsed[cat.id]}
            visible={cat.visible !== false}
            onToggleCollapse={() => setCollapsed((c) => ({ ...c, [cat.id]: !c[cat.id] }))}
            onToggleVisible={() => applyMutation((d) => D.updateCategory(d, cat.id, { visible: cat.visible === false }))}
            onEdit={() => openCategory(cat.id)}
          />
          {!collapsed[cat.id] && (cat.services || []).map((s) => (
            <ServiceRow
              key={s.id}
              service={s}
              onToggle={() => applyMutation((d) => D.updateService(d, cat.id, s.id, { visible: s.visible === false }))}
              onOpen={() => openService(cat.id, s.id)}
            />
          ))}
          {!collapsed[cat.id] && !query && (
            <button type="button" style={styles.addBtn} onClick={() => addServiceTo(cat.id)}>+ Ajouter un soin</button>
          )}
        </div>
      ))}

      {query && view.categories.length === 0 && (
        <p style={{ color: "rgba(255,255,255,0.5)", textAlign: "center", padding: "32px 16px" }}>Aucun résultat pour « {query} »</p>
      )}

      {!query && (
        <button type="button" style={styles.addBtn} onClick={addCategory}>+ Ajouter une catégorie</button>
      )}

      {target?.type === "service" && liveService && (
        <DetailSheet
          target={{ type: "service", service: liveService }}
          onChange={(updates) => applyMutation((d) => D.updateService(d, target.catId, target.serviceId, updates))}
          onDelete={() => { applyMutation((d) => D.removeService(d, target.catId, target.serviceId)); closeSheet(); }}
          onClose={closeSheet}
        />
      )}
      {target?.type === "category" && liveCategory && (
        <DetailSheet
          target={{ type: "category", category: liveCategory }}
          onChange={(updates) => applyMutation((d) => D.updateCategory(d, target.catId, updates))}
          onDelete={() => { applyMutation((d) => D.removeCategory(d, target.catId)); closeSheet(); }}
          onClose={closeSheet}
        />
      )}

      {undoVisible && !target && (
        <div style={styles.toast}>
          <span>Modification enregistrée</span>
          <button type="button" onClick={() => { undo(); setUndoVisible(false); }} style={{ border: "none", background: "transparent", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Annuler</button>
        </div>
      )}

      <style>{`* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; } input, textarea { font-family: inherit; }`}</style>
    </div>
  );
}
