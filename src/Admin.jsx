import React, { useEffect, useRef, useState } from "react";

const ADMIN_FN = "/.netlify/functions/admin";
const IMGBB_KEY = import.meta.env.VITE_IMGBB_KEY || "";

function serializeData(data) {
  return JSON.stringify(data, null, 2);
}

async function callAdmin(body) {
  let response;
  try {
    response = await fetch(ADMIN_FN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Connexion au serveur impossible. Reessayez.");
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error((payload && payload.error) || `Erreur (${response.status})`);
  }
  // The function always answers with JSON { ok: true }. Anything else (e.g. the
  // SPA fallback page when the function is not deployed) must NOT count as success.
  if (!payload || payload.ok !== true) {
    throw new Error("Reponse inattendue du serveur. Verifiez la configuration.");
  }
  return payload;
}

export default function AdminPanel() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [password, setPassword] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(null);
  const [view, setView] = useState("categories");
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [activeServiceId, setActiveServiceId] = useState(null);

  const toastTimerRef = useRef(null);

  const currentCategory = data?.categories.find((category) => category.id === activeCategoryId) || null;
  const currentService = (currentCategory?.services || []).find((service) => service.id === activeServiceId) || null;
  const currentSnapshot = data ? serializeData(data) : "";
  const hasUnsavedChanges = Boolean(data && lastSavedSnapshot !== null && currentSnapshot !== lastSavedSnapshot);
  const canSave = Boolean(data && !saving && hasUnsavedChanges);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!data) return;

    if (activeCategoryId && !data.categories.some((category) => category.id === activeCategoryId)) {
      setActiveCategoryId(null);
      setActiveServiceId(null);
      setView("categories");
      return;
    }

    if (
      activeCategoryId &&
      activeServiceId &&
      !data.categories
        .find((category) => category.id === activeCategoryId)
        ?.services.some((service) => service.id === activeServiceId)
    ) {
      setActiveServiceId(null);
      if (view === "editService") setView("services");
    }
  }, [activeCategoryId, activeServiceId, data, view]);

  useEffect(() => {
    if (!authenticated || data) return;

    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setLoadError("");

      try {
        const response = await fetch(`/data.json?${Date.now()}`);
        if (!response.ok) {
          throw new Error(`Impossible de charger les donnees (${response.status})`);
        }
        const nextData = await response.json();
        if (cancelled) return;
        setData(nextData);
        setLastSavedSnapshot(serializeData(nextData));
      } catch (error) {
        if (cancelled) return;
        setLoadError(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [authenticated, data, reloadKey]);

  function showMsg(text, type = "success") {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setMessage({ text, type });
    toastTimerRef.current = window.setTimeout(() => setMessage(null), 3200);
  }

  async function handleSave() {
    if (!data || saving || !hasUnsavedChanges) return;

    setSaving(true);
    try {
      await callAdmin({ action: "save", password, data });
      setLastSavedSnapshot(currentSnapshot);
      showMsg("Modifications enregistrees et publiees.");
    } catch (error) {
      showMsg(`Erreur de sauvegarde: ${error.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogin() {
    if (loggingIn || !password) return;

    setLoggingIn(true);
    try {
      await callAdmin({ action: "login", password });
      setAuthenticated(true);
    } catch (error) {
      showMsg(error.message || "Mot de passe incorrect.", "error");
    } finally {
      setLoggingIn(false);
    }
  }

  function handleRetryLoad() {
    setLoadError("");
    setReloadKey((value) => value + 1);
  }

  function updateCategory(catId, updates) {
    setData((prev) => ({
      ...prev,
      categories: prev.categories.map((category) =>
        category.id === catId ? { ...category, ...updates } : category,
      ),
    }));
  }

  function updateService(catId, serviceId, updates) {
    setData((prev) => ({
      ...prev,
      categories: prev.categories.map((category) =>
        category.id === catId
          ? {
              ...category,
              services: (category.services || []).map((service) =>
                service.id === serviceId ? { ...service, ...updates } : service,
              ),
            }
          : category,
      ),
    }));
  }

  function addService(catId) {
    const maxId = Math.max(
      0,
      ...data.categories.flatMap((category) => (category.services || []).map((service) => service.id)),
    );
    const newService = {
      id: maxId + 1,
      name: "Nouveau soin",
      price: 0,
      duration: "1h",
      image: `https://picsum.photos/seed/new${maxId + 1}/400/300`,
      description: "",
      visible: true,
    };

    setData((prev) => ({
      ...prev,
      categories: prev.categories.map((category) =>
        category.id === catId
          ? { ...category, services: [...(category.services || []), newService] }
          : category,
      ),
    }));
    setActiveCategoryId(catId);
    setActiveServiceId(newService.id);
    setView("editService");
  }

  function removeService(catId, serviceId) {
    const service = data.categories
      .find((category) => category.id === catId)
      ?.services.find((item) => item.id === serviceId);

    if (!service) return;
    if (!window.confirm(`Supprimer "${service.name}" ?`)) return;

    setData((prev) => ({
      ...prev,
      categories: prev.categories.map((category) =>
        category.id === catId
          ? { ...category, services: (category.services || []).filter((item) => item.id !== serviceId) }
          : category,
      ),
    }));
    setActiveServiceId(null);
    setView("services");
  }

  function addCategory() {
    const id = `cat-${Date.now()}`;
    const newCategory = {
      id,
      name: "Nouvelle categorie",
      image: `https://picsum.photos/seed/${id}/200/200`,
      heroImage: `https://picsum.photos/seed/${id}/800/1200`,
      visible: true,
      services: [],
    };

    setData((prev) => ({
      ...prev,
      categories: [...prev.categories, newCategory],
    }));
    setActiveCategoryId(id);
    setActiveServiceId(null);
    setView("editCategory");
  }

  function removeCategory(catId) {
    const category = data.categories.find((item) => item.id === catId);

    if (!category) return;
    if (!window.confirm(`Supprimer la categorie "${category.name}" et ses services ?`)) return;

    setData((prev) => ({
      ...prev,
      categories: prev.categories.filter((item) => item.id !== catId),
    }));
    setActiveCategoryId(null);
    setActiveServiceId(null);
    setView("categories");
  }

  function renderBody() {
    if (!authenticated) {
      return (
        <LoginScreen
          password={password}
          setPassword={setPassword}
          onLogin={handleLogin}
          loggingIn={loggingIn}
        />
      );
    }

    if (loading && !data) {
      return <LoadingScreen text="Chargement des donnees..." />;
    }

    if (loadError && !data) {
      return (
        <ErrorScreen
          title="Impossible de charger les donnees"
          description={loadError}
          onRetry={handleRetryLoad}
        />
      );
    }

    if (!data) return <LoadingScreen text="Preparation de l'administration..." />;

    return (
      <div style={styles.shell}>
        <div style={styles.topBar}>
          {view !== "categories" ? (
            <button
              type="button"
              onClick={() => {
                if (view === "editService") setView("services");
                else if (view === "services") setView("categories");
                else setView("categories");
              }}
              style={styles.backBtn}
            >
              ←
            </button>
          ) : (
            <div style={styles.backBtnSpacer} />
          )}

          <div style={styles.topTitleWrap}>
            <span style={styles.topTitle}>
              {view === "categories"
                ? "Glow Beauty Admin"
                : view === "services"
                  ? currentCategory?.name || "Services"
                  : view === "editService"
                    ? "Modifier soin"
                    : "Modifier categorie"}
            </span>
            <span style={styles.topMeta}>
              {hasUnsavedChanges ? "Modifications non enregistrees" : "A jour"}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            style={{
              ...styles.saveBtn,
              opacity: canSave ? 1 : 0.45,
              cursor: canSave ? "pointer" : "default",
            }}
          >
            {saving ? "..." : "Sauver"}
          </button>
        </div>

        <div style={styles.content}>
          {view === "categories" && (
            <CategoryList
              categories={data.categories}
              onToggle={(catId) => {
                const category = data.categories.find((item) => item.id === catId);
                updateCategory(catId, { visible: category?.visible === false });
              }}
              onTap={(category) => {
                setActiveCategoryId(category.id);
                setActiveServiceId(null);
                setView("services");
              }}
              onEdit={(category) => {
                setActiveCategoryId(category.id);
                setActiveServiceId(null);
                setView("editCategory");
              }}
              onAdd={addCategory}
            />
          )}

          {view === "services" && currentCategory && (
            <ServiceList
              category={currentCategory}
              onToggle={(serviceId) => {
                const service = (currentCategory.services || []).find((item) => item.id === serviceId);
                updateService(currentCategory.id, serviceId, { visible: service?.visible === false });
              }}
              onTap={(service) => {
                setActiveServiceId(service.id);
                setView("editService");
              }}
              onAdd={() => addService(currentCategory.id)}
              onRemove={(service) => removeService(currentCategory.id, service.id)}
            />
          )}

          {view === "editService" && currentCategory && currentService && (
            <EditServiceForm
              service={currentService}
              onChange={(updates) => updateService(currentCategory.id, currentService.id, updates)}
              showMsg={showMsg}
            />
          )}

          {view === "editCategory" && currentCategory && (
            <EditCategoryForm
              category={currentCategory}
              onChange={(updates) => updateCategory(currentCategory.id, updates)}
              onRemove={() => removeCategory(currentCategory.id)}
              showMsg={showMsg}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {message && (
        <div
          style={{
            ...styles.toast,
            background: message.type === "error" ? "#dc2626" : "#16a34a",
          }}
        >
          {message.text}
        </div>
      )}

      {renderBody()}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}

function LoginScreen({ password, setPassword, onLogin, loggingIn }) {
  return (
    <div style={styles.screenScroller}>
      <div style={styles.authCard}>
        <span style={styles.eyebrow}>Administration</span>
        <h1 style={styles.authTitle}>Glow Beauty</h1>
        <p style={styles.authText}>
          Connectez-vous pour gerer les categories, les soins et les parametres.
        </p>

        <label style={styles.label}>Mot de passe</label>
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && onLogin()}
          style={styles.input}
          autoFocus
          disabled={loggingIn}
        />

        <button
          type="button"
          onClick={onLogin}
          disabled={loggingIn}
          style={{
            ...styles.primaryBtn,
            opacity: loggingIn ? 0.6 : 1,
            cursor: loggingIn ? "default" : "pointer",
          }}
        >
          {loggingIn ? "Connexion..." : "Connexion"}
        </button>
      </div>
    </div>
  );
}

function LoadingScreen({ text }) {
  return (
    <div style={styles.statusScreen}>
      <div style={styles.statusCard}>
        <div style={styles.spinner} />
        <p style={styles.statusText}>{text}</p>
      </div>
    </div>
  );
}

function ErrorScreen({ title, description, onRetry, onEditSettings, onReset, onContinueLocal }) {
  return (
    <div style={styles.statusScreen}>
      <div style={styles.statusCard}>
        <span style={styles.errorDot}>!</span>
        <h2 style={styles.statusTitle}>{title}</h2>
        <p style={styles.statusText}>{description}</p>

        <div style={styles.statusActions}>
          {onRetry && (
            <button type="button" onClick={onRetry} style={styles.primaryBtn}>
              Reessayer
            </button>
          )}
          {onEditSettings && (
            <button type="button" onClick={onEditSettings} style={styles.secondaryBtnFull}>
              Modifier les parametres
            </button>
          )}
          {onContinueLocal && (
            <button type="button" onClick={onContinueLocal} style={styles.secondaryBtnFull}>
              Continuer en mode local
            </button>
          )}
          {onReset && (
            <button type="button" onClick={onReset} style={styles.dangerBtn}>
              Reinitialiser
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryList({ categories, onToggle, onTap, onEdit, onAdd }) {
  return (
    <div>
      <SectionHeading
        title="Categories"
        subtitle="Activez, masquez ou modifiez les univers visibles sur le site."
      />

      {categories.length === 0 && (
        <div style={styles.emptyState}>
          <p style={styles.emptyTitle}>Aucune categorie</p>
          <p style={styles.emptyText}>Ajoutez votre premiere categorie pour commencer.</p>
        </div>
      )}

      {categories.map((category) => (
        <div key={category.id} style={styles.listItem}>
          <button type="button" onClick={() => onTap(category)} style={styles.listMainButton}>
            <div
              style={{
                ...styles.thumb,
                opacity: category.visible === false ? 0.3 : 1,
              }}
            >
              <img src={category.image} alt="" style={styles.thumbImage} />
            </div>

            <div style={styles.listTextWrap}>
              <p
                style={{
                  ...styles.itemTitle,
                  opacity: category.visible === false ? 0.45 : 1,
                  textDecoration: category.visible === false ? "line-through" : "none",
                }}
              >
                {category.name}
              </p>
              <p style={styles.itemMeta}>{(category.services || []).length} soins</p>
            </div>
          </button>

          <div style={styles.listActions}>
            <button type="button" onClick={() => onEdit(category)} style={styles.iconBtn}>
              ✎
            </button>
            <ToggleSwitch value={category.visible !== false} onChange={() => onToggle(category.id)} />
          </div>
        </div>
      ))}

      <button type="button" onClick={onAdd} style={styles.addBtn}>
        + Ajouter categorie
      </button>
    </div>
  );
}

function ServiceList({ category, onToggle, onTap, onAdd, onRemove }) {
  return (
    <div>
      <SectionHeading
        title={category.name}
        subtitle="Gerez l'ordre visuel, la disponibilite et les details de chaque soin."
      />

      {(category.services || []).length === 0 && (
        <div style={styles.emptyState}>
          <p style={styles.emptyTitle}>Aucun soin dans cette categorie</p>
          <p style={styles.emptyText}>Ajoutez un soin pour alimenter l'experience client.</p>
        </div>
      )}

      {(category.services || []).map((service) => (
        <div key={service.id} style={styles.listItem}>
          <button type="button" onClick={() => onTap(service)} style={styles.listMainButton}>
            <div
              style={{
                ...styles.thumb,
                opacity: service.visible === false ? 0.3 : 1,
              }}
            >
              <img src={service.image} alt="" style={styles.thumbImage} />
            </div>

            <div style={styles.listTextWrap}>
              <p
                style={{
                  ...styles.itemTitle,
                  fontSize: "15px",
                  opacity: service.visible === false ? 0.45 : 1,
                  textDecoration: service.visible === false ? "line-through" : "none",
                }}
              >
                {service.name}
              </p>
              <p style={styles.itemMeta}>
                {service.price} DH · {service.duration}
              </p>
            </div>
          </button>

          <div style={styles.listActions}>
            <button
              type="button"
              onClick={() => onRemove(service)}
              style={{ ...styles.iconBtn, color: "#ef4444" }}
            >
              ✕
            </button>
            <ToggleSwitch value={service.visible !== false} onChange={() => onToggle(service.id)} />
          </div>
        </div>
      ))}

      <button type="button" onClick={onAdd} style={styles.addBtn}>
        + Ajouter soin
      </button>
    </div>
  );
}

function EditServiceForm({ service, onChange, showMsg }) {
  const [uploading, setUploading] = useState(false);

  async function handleImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!IMGBB_KEY) {
      showMsg("Upload d'image non active. Collez une URL d'image ci-dessous.", "error");
      event.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const url = await uploadToImgBB(file, IMGBB_KEY);
      onChange({ image: url });
      showMsg("Image mise a jour.");
    } catch (error) {
      showMsg(`Erreur upload: ${error.message}`, "error");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  return (
    <div>
      <SectionHeading
        title="Edition du soin"
        subtitle="Conservez des champs simples pour limiter les erreurs de saisie."
      />

      <div style={styles.card}>
        <div style={styles.previewImage}>
          <img src={service.image} alt="" style={styles.previewImageTag} />
          <label style={styles.uploadOverlay}>
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
            {uploading ? "Upload..." : "Changer l'image"}
          </label>
        </div>

        <label style={styles.label}>Nom</label>
        <input
          value={service.name}
          onChange={(event) => onChange({ name: event.target.value })}
          style={styles.input}
        />

        <div style={styles.twoCol}>
          <div>
            <label style={styles.label}>Prix (DH)</label>
            <input
              type="number"
              value={service.price}
              onChange={(event) =>
                onChange({ price: event.target.value === "" ? 0 : Number(event.target.value) })
              }
              style={styles.input}
            />
          </div>

          <div>
            <label style={styles.label}>Duree</label>
            <input
              value={service.duration}
              onChange={(event) => onChange({ duration: event.target.value })}
              style={styles.input}
            />
          </div>
        </div>

        <label style={styles.label}>Description</label>
        <textarea
          value={service.description || ""}
          onChange={(event) => onChange({ description: event.target.value })}
          rows={4}
          style={styles.textarea}
        />

        <label style={styles.label}>URL image</label>
        <input
          value={service.image}
          onChange={(event) => onChange({ image: event.target.value })}
          style={styles.input}
        />
      </div>
    </div>
  );
}

function EditCategoryForm({ category, onChange, onRemove, showMsg }) {
  const [uploading, setUploading] = useState(false);

  async function handleImageUpload(event, field) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!IMGBB_KEY) {
      showMsg("Upload d'image non active. Collez une URL d'image ci-dessous.", "error");
      event.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const url = await uploadToImgBB(file, IMGBB_KEY);
      onChange({ [field]: url });
      showMsg("Image mise a jour.");
    } catch (error) {
      showMsg(`Erreur upload: ${error.message}`, "error");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  return (
    <div>
      <SectionHeading
        title="Edition de la categorie"
        subtitle="Gardez le nom court et l'imagerie nette pour conserver une navigation claire."
      />

      <div style={styles.card}>
        <div style={styles.categoryTop}>
          <div style={styles.categoryThumbWrap}>
            <div style={styles.categoryThumb}>
              <img src={category.image} alt="" style={styles.thumbImage} />
            </div>
            <label style={styles.smallUpload}>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => handleImageUpload(event, "image")}
                style={{ display: "none" }}
              />
              📷
            </label>
          </div>

          <div style={styles.categoryTopText}>
            <p style={styles.itemMeta}>Icone categorie</p>
            <p style={styles.cardText}>Utilisee dans l'orbite principale du site.</p>
          </div>
        </div>

        <div style={styles.heroPreview}>
          <img src={category.heroImage} alt="" style={styles.heroPreviewImage} />
          <label style={styles.uploadOverlay}>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => handleImageUpload(event, "heroImage")}
              style={{ display: "none" }}
            />
            {uploading ? "Upload..." : "Changer la banniere"}
          </label>
        </div>

        <label style={styles.label}>Nom de la categorie</label>
        <input
          value={category.name}
          onChange={(event) => onChange({ name: event.target.value })}
          style={styles.input}
        />

        <label style={styles.label}>Identifiant</label>
        <input value={category.id} disabled style={{ ...styles.input, opacity: 0.45 }} />

        <label style={styles.label}>URL icone</label>
        <input
          value={category.image}
          onChange={(event) => onChange({ image: event.target.value })}
          style={styles.input}
        />

        <label style={styles.label}>URL banniere</label>
        <input
          value={category.heroImage}
          onChange={(event) => onChange({ heroImage: event.target.value })}
          style={styles.input}
        />

        <button type="button" onClick={onRemove} style={styles.dangerBtn}>
          Supprimer cette categorie
        </button>
      </div>
    </div>
  );
}

function SectionHeading({ title, subtitle }) {
  return (
    <div style={styles.sectionHeading}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <p style={styles.sectionText}>{subtitle}</p>
    </div>
  );
}

function ToggleSwitch({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      style={{
        ...styles.toggle,
        background: value ? "#22c55e" : "rgba(255,255,255,0.12)",
      }}
      aria-pressed={value}
    >
      <span
        style={{
          ...styles.toggleKnob,
          transform: value ? "translateX(18px)" : "translateX(0)",
        }}
      />
    </button>
  );
}

async function uploadToImgBB(file, apiKey) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("Upload impossible");

  const json = await response.json();
  return json.data.url;
}

const styles = {
  container: {
    height: "100dvh",
    minHeight: "100vh",
    background: "#000",
    color: "#fff",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  shell: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
  },
  screenScroller: {
    height: "100%",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    padding: "max(28px, env(safe-area-inset-top, 0px) + 20px) 20px calc(28px + env(safe-area-inset-bottom, 0px))",
  },
  authCard: {
    width: "min(100%, 460px)",
    margin: "max(32px, 10vh) auto",
    padding: "28px",
    borderRadius: "28px",
    background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.35)",
  },
  eyebrow: {
    display: "inline-block",
    fontSize: "11px",
    letterSpacing: "1.8px",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.45)",
    marginBottom: "12px",
  },
  authTitle: {
    fontSize: "30px",
    lineHeight: 1.1,
    marginBottom: "8px",
  },
  authText: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.58)",
    marginBottom: "24px",
  },
  card: {
    padding: "20px",
    borderRadius: "22px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 14px 40px rgba(0,0,0,0.2)",
  },
  cardText: {
    fontSize: "13px",
    color: "rgba(255,255,255,0.5)",
    lineHeight: 1.6,
    marginTop: "6px",
  },
  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    color: "rgba(255,255,255,0.42)",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    marginBottom: "8px",
  },
  input: {
    width: "100%",
    padding: "15px 16px",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    fontSize: "16px",
    outline: "none",
    marginBottom: "16px",
  },
  textarea: {
    width: "100%",
    padding: "15px 16px",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    fontSize: "16px",
    outline: "none",
    marginBottom: "16px",
    resize: "vertical",
    minHeight: "112px",
    fontFamily: "inherit",
  },
  primaryBtn: {
    width: "100%",
    minHeight: "48px",
    padding: "14px 16px",
    borderRadius: "16px",
    border: "none",
    background: "#fff",
    color: "#000",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryBtnFull: {
    width: "100%",
    minHeight: "48px",
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
  },
  statusScreen: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },
  statusCard: {
    width: "min(100%, 480px)",
    padding: "28px",
    borderRadius: "26px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    textAlign: "center",
  },
  spinner: {
    width: "28px",
    height: "28px",
    margin: "0 auto 16px",
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.1)",
    borderTopColor: "rgba(255,255,255,0.6)",
    animation: "spin 0.8s linear infinite",
  },
  errorDot: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    background: "rgba(220,38,38,0.12)",
    color: "#f87171",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    marginBottom: "14px",
  },
  statusTitle: {
    fontSize: "22px",
    marginBottom: "10px",
  },
  statusText: {
    fontSize: "14px",
    color: "rgba(255,255,255,0.6)",
    lineHeight: 1.6,
  },
  statusActions: {
    display: "grid",
    gap: "12px",
    marginTop: "20px",
  },
  topBar: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "max(14px, env(safe-area-inset-top, 0px) + 10px) 16px 14px",
    background: "rgba(0,0,0,0.92)",
    backdropFilter: "blur(20px)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  topTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  topTitle: {
    display: "block",
    fontSize: "17px",
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  topMeta: {
    display: "block",
    marginTop: "3px",
    fontSize: "12px",
    color: "rgba(255,255,255,0.38)",
  },
  backBtn: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    fontSize: "19px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  backBtnSpacer: {
    width: "44px",
    height: "44px",
    flexShrink: 0,
  },
  saveBtn: {
    minWidth: "90px",
    minHeight: "44px",
    padding: "10px 16px",
    borderRadius: "999px",
    border: "none",
    background: "#fff",
    color: "#000",
    fontSize: "14px",
    fontWeight: 700,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    padding: "18px 16px calc(110px + env(safe-area-inset-bottom, 0px))",
  },
  sectionHeading: {
    marginBottom: "18px",
  },
  sectionTitle: {
    fontSize: "24px",
    marginBottom: "6px",
  },
  sectionText: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.52)",
  },
  emptyState: {
    padding: "22px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.04)",
    border: "1px dashed rgba(255,255,255,0.14)",
    marginBottom: "14px",
  },
  emptyTitle: {
    fontSize: "16px",
    fontWeight: 700,
    marginBottom: "6px",
  },
  emptyText: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.52)",
  },
  listItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    marginBottom: "10px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  listMainButton: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "14px",
    border: "none",
    background: "transparent",
    color: "inherit",
    padding: 0,
    textAlign: "left",
    cursor: "pointer",
  },
  listTextWrap: {
    minWidth: 0,
  },
  thumb: {
    width: "56px",
    height: "56px",
    borderRadius: "16px",
    overflow: "hidden",
    flexShrink: 0,
  },
  thumbImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  itemTitle: {
    fontSize: "16px",
    fontWeight: 600,
    margin: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  itemMeta: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.38)",
    marginTop: "4px",
    lineHeight: 1.4,
  },
  listActions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  },
  addBtn: {
    width: "100%",
    minHeight: "52px",
    padding: "16px",
    borderRadius: "16px",
    border: "1px dashed rgba(255,255,255,0.15)",
    background: "transparent",
    color: "rgba(255,255,255,0.55)",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: "10px",
  },
  dangerBtn: {
    width: "100%",
    minHeight: "48px",
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1px solid rgba(239,68,68,0.32)",
    background: "rgba(239,68,68,0.08)",
    color: "#f87171",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
  },
  iconBtn: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.6)",
    fontSize: "15px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  toggle: {
    width: "44px",
    height: "26px",
    borderRadius: "13px",
    padding: "3px",
    border: "none",
    cursor: "pointer",
    flexShrink: 0,
  },
  toggleKnob: {
    display: "block",
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    background: "#fff",
    transition: "transform 0.2s ease",
  },
  previewImage: {
    position: "relative",
    height: "190px",
    borderRadius: "22px",
    overflow: "hidden",
    marginBottom: "20px",
  },
  previewImageTag: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  uploadOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.45)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "12px",
  },
  categoryTop: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "20px",
  },
  categoryThumbWrap: {
    position: "relative",
    flexShrink: 0,
  },
  categoryThumb: {
    width: "84px",
    height: "84px",
    borderRadius: "50%",
    overflow: "hidden",
  },
  categoryTopText: {
    minWidth: 0,
  },
  smallUpload: {
    position: "absolute",
    right: "-2px",
    bottom: "-2px",
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    border: "2px solid #000",
    background: "#fff",
    color: "#000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  heroPreview: {
    position: "relative",
    height: "156px",
    borderRadius: "18px",
    overflow: "hidden",
    marginBottom: "20px",
  },
  heroPreviewImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "brightness(0.6)",
  },
  toast: {
    position: "fixed",
    top: "max(16px, env(safe-area-inset-top, 0px) + 10px)",
    left: "16px",
    right: "16px",
    padding: "14px 18px",
    borderRadius: "16px",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 700,
    textAlign: "center",
    zIndex: 40,
    animation: "fadeIn 0.2s ease",
    boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
  },
};
