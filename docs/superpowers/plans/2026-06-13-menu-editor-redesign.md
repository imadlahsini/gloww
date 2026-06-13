# Menu editor UX redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the nested Categories→Services→form admin with a single search-first "Mes soins" editor that supports inline price/visibility edits, a slide-up detail sheet, autosave, and a real photo picker — built for a non-technical phone user.

**Architecture:** Decompose the current monolithic `src/Admin.jsx` into focused modules under `src/admin/`. Pure data/transform logic and the autosave behavior become unit-tested modules; UI is composed from small components. The existing serverless function (`netlify/functions/admin.js`) is reused unchanged — autosave just calls its `save` action on a debounce. The public menu (`src/App.jsx`) and the password login flow are untouched.

**Tech Stack:** React 18, Vite 6, Netlify Functions. New dev dependency: Vitest + React Testing Library + jsdom for tests. Spec: `docs/superpowers/specs/2026-06-13-menu-editor-ux-design.md`.

---

## Working branch

Implement on a feature branch off `main` (e.g. `menu-editor-impl`), or in a git worktree if using subagent-driven execution. Commit after every task. Open a PR at the end so it deploys to a Netlify preview before going live (same flow as the admin function shipped earlier).

## File structure

Created:
- `src/admin/data.js` — pure data helpers: serialize, id generation, immutable add/update/remove, search filter. No React, no I/O.
- `src/admin/api.js` — I/O: `callAdmin()`, `loadData()`, `uploadPhoto()`, `IMGBB_KEY`, `ADMIN_FN`.
- `src/admin/useAutosave.js` — React hook: holds `data`, debounced save via `callAdmin`, status + undo stack.
- `src/admin/styles.js` — shared inline style objects (dark theme), extracted from today's `Admin.jsx`.
- `src/admin/SaveStatusChip.jsx` — status indicator (`Enregistrement…` / `Enregistré` / retry).
- `src/admin/ServiceRow.jsx` — one service: thumbnail, name, inline price pill, on/off toggle.
- `src/admin/CategoryHeader.jsx` — collapsible category header + edit affordance.
- `src/admin/DetailSheet.jsx` — bottom sheet to edit a service or a category (photo, fields, delete+undo).
- `src/admin/PhotoPicker.jsx` — camera/gallery upload via ImgBB.
- `src/admin/SearchBar.jsx` — search input.
- `src/admin/MenuEditor.jsx` — the "Mes soins" screen: search + grouped list + add buttons + save chip + sheet orchestration.
- `src/admin/LoginScreen.jsx` — password login (ported from current Admin.jsx).
- `src/admin/AdminApp.jsx` — top-level: login gate → load data → MenuEditor.
- Tests: `src/admin/data.test.js`, `src/admin/api.test.js`, `src/admin/useAutosave.test.js`, `src/admin/ServiceRow.test.jsx`, `src/admin/MenuEditor.test.jsx`.
- `vitest.config.js`, `src/test/setup.js`.

Modified:
- `src/Admin.jsx` — becomes a 1-line re-export of `AdminApp` so `main.jsx`'s `lazy(() => import('./Admin'))` keeps working.
- `package.json` — add `test` script + dev dependencies.

Data model (unchanged): `data = { categories: [{ id, name, image, heroImage, visible, services: [{ id, name, price, duration, image, description, visible }] }] }`.

---

## Task 1: Test harness

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`
- Create: `src/test/setup.js`
- Create: `src/admin/smoke.test.js` (temporary)

- [ ] **Step 1: Install dev dependencies**

Run:
```bash
npm install -D vitest@^2 jsdom@^25 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14
```

- [ ] **Step 2: Add the test script to `package.json`**

In the `"scripts"` block add:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.js`**

```js
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
  },
});
```

- [ ] **Step 4: Create `src/test/setup.js`**

```js
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Create `src/admin/smoke.test.js`**

```js
import { describe, it, expect } from "vitest";

describe("harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run the test to verify the harness works**

Run: `npm test`
Expected: PASS, 1 test passed.

- [ ] **Step 7: Delete the smoke test and commit**

```bash
rm src/admin/smoke.test.js
git add package.json package-lock.json vitest.config.js src/test/setup.js
git commit -m "test: add vitest + react testing library harness"
```

---

## Task 2: Data helpers (`src/admin/data.js`)

**Files:**
- Create: `src/admin/data.js`
- Test: `src/admin/data.test.js`

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect } from "vitest";
import {
  serializeData,
  nextServiceId,
  updateService,
  addService,
  removeService,
  updateCategory,
  addCategory,
  removeCategory,
  matchesQuery,
  filterData,
} from "./data.js";

const sample = () => ({
  categories: [
    {
      id: "head-spa",
      name: "Head Spa",
      image: "i",
      heroImage: "h",
      visible: true,
      services: [
        { id: 1, name: "Royale", price: 600, duration: "1h", image: "x", description: "", visible: true },
        { id: 2, name: "Detox", price: 300, duration: "30m", image: "y", description: "", visible: false },
      ],
    },
    {
      id: "lifting",
      name: "Lifting",
      image: "i2",
      heroImage: "h2",
      visible: true,
      services: [{ id: 5, name: "Colombien", price: 150, duration: "1h", image: "z", description: "", visible: true }],
    },
  ],
});

describe("serializeData", () => {
  it("is stable and pretty-printed", () => {
    expect(serializeData(sample())).toBe(JSON.stringify(sample(), null, 2));
  });
});

describe("nextServiceId", () => {
  it("is max existing id + 1 across all categories", () => {
    expect(nextServiceId(sample())).toBe(6);
  });
  it("is 1 when there are no services", () => {
    expect(nextServiceId({ categories: [] })).toBe(1);
  });
});

describe("updateService", () => {
  it("changes only the targeted service and does not mutate input", () => {
    const data = sample();
    const next = updateService(data, "head-spa", 1, { price: 650 });
    expect(next.categories[0].services[0].price).toBe(650);
    expect(data.categories[0].services[0].price).toBe(600);
  });
});

describe("addService", () => {
  it("appends a service to the category", () => {
    const next = addService(sample(), "lifting", { id: 6, name: "X", price: 0, duration: "1h", image: "", description: "", visible: true });
    expect(next.categories[1].services).toHaveLength(2);
    expect(next.categories[1].services[1].id).toBe(6);
  });
});

describe("removeService", () => {
  it("removes the targeted service", () => {
    const next = removeService(sample(), "head-spa", 2);
    expect(next.categories[0].services.map((s) => s.id)).toEqual([1]);
  });
});

describe("updateCategory", () => {
  it("changes only the targeted category", () => {
    const next = updateCategory(sample(), "lifting", { name: "Lift" });
    expect(next.categories[1].name).toBe("Lift");
    expect(next.categories[0].name).toBe("Head Spa");
  });
});

describe("addCategory / removeCategory", () => {
  it("adds then removes by id", () => {
    const cat = { id: "cat-x", name: "New", image: "", heroImage: "", visible: true, services: [] };
    const added = addCategory(sample(), cat);
    expect(added.categories).toHaveLength(3);
    const removed = removeCategory(added, "cat-x");
    expect(removed.categories).toHaveLength(2);
  });
});

describe("matchesQuery", () => {
  it("is case- and accent-insensitive on the name", () => {
    expect(matchesQuery({ name: "Détox" }, "detox")).toBe(true);
    expect(matchesQuery({ name: "Royale" }, "xyz")).toBe(false);
  });
  it("matches everything on empty query", () => {
    expect(matchesQuery({ name: "anything" }, "")).toBe(true);
  });
});

describe("filterData", () => {
  it("returns all categories unchanged on empty query", () => {
    expect(filterData(sample(), "")).toEqual(sample());
  });
  it("keeps only matching services and drops empty categories when querying", () => {
    const out = filterData(sample(), "colombien");
    expect(out.categories).toHaveLength(1);
    expect(out.categories[0].id).toBe("lifting");
    expect(out.categories[0].services).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/admin/data.test.js`
Expected: FAIL — cannot import from `./data.js` (module/exports missing).

- [ ] **Step 3: Implement `src/admin/data.js`**

```js
export function serializeData(data) {
  return JSON.stringify(data, null, 2);
}

export function nextServiceId(data) {
  const ids = data.categories.flatMap((c) => (c.services || []).map((s) => s.id));
  return ids.length ? Math.max(...ids) + 1 : 1;
}

export function updateService(data, catId, serviceId, updates) {
  return {
    ...data,
    categories: data.categories.map((c) =>
      c.id === catId
        ? { ...c, services: (c.services || []).map((s) => (s.id === serviceId ? { ...s, ...updates } : s)) }
        : c,
    ),
  };
}

export function addService(data, catId, service) {
  return {
    ...data,
    categories: data.categories.map((c) =>
      c.id === catId ? { ...c, services: [...(c.services || []), service] } : c,
    ),
  };
}

export function removeService(data, catId, serviceId) {
  return {
    ...data,
    categories: data.categories.map((c) =>
      c.id === catId ? { ...c, services: (c.services || []).filter((s) => s.id !== serviceId) } : c,
    ),
  };
}

export function updateCategory(data, catId, updates) {
  return {
    ...data,
    categories: data.categories.map((c) => (c.id === catId ? { ...c, ...updates } : c)),
  };
}

export function addCategory(data, category) {
  return { ...data, categories: [...data.categories, category] };
}

export function removeCategory(data, catId) {
  return { ...data, categories: data.categories.filter((c) => c.id !== catId) };
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .split("")
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code < 0x300 || code > 0x36f;
    })
    .join("");
}

export function matchesQuery(service, query) {
  const q = normalize(query).trim();
  if (!q) return true;
  return normalize(service.name).includes(q);
}

export function filterData(data, query) {
  if (!normalize(query).trim()) return data;
  return {
    ...data,
    categories: data.categories
      .map((c) => ({ ...c, services: (c.services || []).filter((s) => matchesQuery(s, query)) }))
      .filter((c) => c.services.length > 0),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/admin/data.test.js`
Expected: PASS — all data tests green.

- [ ] **Step 5: Commit**

```bash
git add src/admin/data.js src/admin/data.test.js
git commit -m "feat(admin): pure data helpers with tests"
```

---

## Task 3: API module (`src/admin/api.js`)

**Files:**
- Create: `src/admin/api.js`
- Test: `src/admin/api.test.js`

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { callAdmin, loadData } from "./api.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("callAdmin", () => {
  it("posts JSON and returns payload on ok+{ok:true}", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, sha: "abc" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await callAdmin({ action: "save", password: "p", data: { categories: [] } });
    expect(out).toEqual({ ok: true, sha: "abc" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/.netlify/functions/admin",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws the server error message on non-ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Mot de passe incorrect." }),
    }));
    await expect(callAdmin({ action: "login", password: "x" })).rejects.toThrow("Mot de passe incorrect.");
  });

  it("throws on ok but missing ok:true (e.g. SPA fallback HTML)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => { throw new Error("not json"); },
    }));
    await expect(callAdmin({ action: "login", password: "x" })).rejects.toThrow(/inattendue/i);
  });
});

describe("loadData", () => {
  it("fetches /data.json with a cache-buster and returns parsed JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ categories: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    const data = await loadData();
    expect(data).toEqual({ categories: [] });
    expect(fetchMock.mock.calls[0][0]).toMatch(/^\/data\.json\?/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/admin/api.test.js`
Expected: FAIL — `./api.js` exports missing.

- [ ] **Step 3: Implement `src/admin/api.js`**

```js
export const ADMIN_FN = "/.netlify/functions/admin";
export const IMGBB_KEY = import.meta.env.VITE_IMGBB_KEY || "";

export async function callAdmin(body) {
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
  if (!payload || payload.ok !== true) {
    throw new Error("Reponse inattendue du serveur. Verifiez la configuration.");
  }
  return payload;
}

export async function loadData() {
  const response = await fetch(`/data.json?${Date.now()}`);
  if (!response.ok) {
    throw new Error(`Impossible de charger les donnees (${response.status})`);
  }
  return response.json();
}

export async function uploadPhoto(file) {
  if (!IMGBB_KEY) {
    throw new Error("Upload d'image non active.");
  }
  const formData = new FormData();
  formData.append("image", file);
  const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) throw new Error("Upload impossible");
  const json = await response.json();
  return json.data.url;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/admin/api.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/api.js src/admin/api.test.js
git commit -m "feat(admin): api module (callAdmin, loadData, uploadPhoto)"
```

---

## Task 4: Autosave hook (`src/admin/useAutosave.js`)

**Files:**
- Create: `src/admin/useAutosave.js`
- Test: `src/admin/useAutosave.test.js`

The hook owns `data`, applies mutations optimistically, debounces a single `callAdmin({action:"save"})`, exposes `status`, and supports `undo`.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const saveMock = vi.fn();
vi.mock("./api.js", () => ({ callAdmin: (...a) => saveMock(...a) }));

import { useAutosave } from "./useAutosave.js";

const base = { categories: [{ id: "c", name: "C", image: "", heroImage: "", visible: true, services: [] }] };

beforeEach(() => {
  vi.useFakeTimers();
  saveMock.mockReset();
  saveMock.mockResolvedValue({ ok: true });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useAutosave", () => {
  it("batches rapid mutations into one save after the debounce", async () => {
    const { result } = renderHook(() => useAutosave({ initialData: base, password: "p", delay: 2000 }));

    act(() => { result.current.mutate((d) => ({ ...d, categories: [{ ...d.categories[0], name: "A" }] })); });
    act(() => { result.current.mutate((d) => ({ ...d, categories: [{ ...d.categories[0], name: "B" }] })); });

    expect(result.current.data.categories[0].name).toBe("B");
    expect(saveMock).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith({ action: "save", password: "p", data: result.current.data });
    expect(result.current.status).toBe("saved");
  });

  it("sets status to error when the save fails", async () => {
    saveMock.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useAutosave({ initialData: base, password: "p", delay: 1000 }));
    act(() => { result.current.mutate((d) => ({ ...d, categories: [{ ...d.categories[0], name: "Z" }] })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.status).toBe("error");
  });

  it("undo restores the previous data and re-saves", async () => {
    const { result } = renderHook(() => useAutosave({ initialData: base, password: "p", delay: 500 }));
    act(() => { result.current.mutate((d) => ({ ...d, categories: [{ ...d.categories[0], name: "New" }] })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(result.current.canUndo).toBe(true);

    act(() => { result.current.undo(); });
    expect(result.current.data.categories[0].name).toBe("C");
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(saveMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/admin/useAutosave.test.js`
Expected: FAIL — `useAutosave` not exported.

- [ ] **Step 3: Implement `src/admin/useAutosave.js`**

```js
import { useCallback, useEffect, useRef, useState } from "react";
import { callAdmin } from "./api.js";

export function useAutosave({ initialData, password, delay = 2000 }) {
  const [data, setData] = useState(initialData);
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const [undoStack, setUndoStack] = useState([]);

  const dataRef = useRef(data);
  const passwordRef = useRef(password);
  const timerRef = useRef(null);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { passwordRef.current = password; }, [password]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus("saving");
      try {
        await callAdmin({ action: "save", password: passwordRef.current, data: dataRef.current });
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, delay);
  }, [delay]);

  const mutate = useCallback((fn) => {
    setUndoStack((stack) => [...stack, dataRef.current]);
    setData((prev) => fn(prev));
    scheduleSave();
  }, [scheduleSave]);

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (!stack.length) return stack;
      const prev = stack[stack.length - 1];
      setData(prev);
      scheduleSave();
      return stack.slice(0, -1);
    });
  }, [scheduleSave]);

  return { data, status, mutate, undo, canUndo: undoStack.length > 0 };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/admin/useAutosave.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/useAutosave.js src/admin/useAutosave.test.js
git commit -m "feat(admin): debounced autosave hook with undo"
```

---

## Task 5: Shared styles (`src/admin/styles.js`)

**Files:**
- Create: `src/admin/styles.js`

No tests (static style data). Reuse the visual language from the current `Admin.jsx`.

- [ ] **Step 1: Create `src/admin/styles.js`**

```js
export const styles = {
  container: {
    minHeight: "100dvh",
    background: "#000",
    color: "#fff",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    position: "relative",
  },
  topBar: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "max(14px, env(safe-area-inset-top, 0px) + 10px) 16px 12px",
    background: "rgba(0,0,0,0.92)",
    backdropFilter: "blur(20px)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  title: { fontSize: "18px", fontWeight: 700, margin: 0, flex: 1 },
  search: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    margin: "12px 16px",
    padding: "11px 12px",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  searchInput: {
    flex: 1,
    border: "none",
    outline: "none",
    background: "transparent",
    color: "#fff",
    fontSize: "16px",
  },
  catHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 16px 6px",
    color: "rgba(255,255,255,0.5)",
    fontSize: "12px",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 16px",
  },
  thumb: { width: "48px", height: "48px", borderRadius: "12px", objectFit: "cover", flexShrink: 0, background: "rgba(255,255,255,0.08)" },
  rowName: { fontSize: "15px", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  pricePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    marginTop: "4px",
    padding: "3px 9px",
    borderRadius: "9px",
    background: "rgba(255,255,255,0.08)",
    border: "none",
    color: "#fff",
    fontSize: "13px",
    cursor: "pointer",
  },
  toggle: { width: "44px", height: "26px", borderRadius: "13px", padding: "3px", border: "none", cursor: "pointer", flexShrink: 0 },
  toggleKnob: { display: "block", width: "20px", height: "20px", borderRadius: "50%", background: "#fff", transition: "transform 0.2s ease" },
  addBtn: {
    width: "calc(100% - 32px)",
    margin: "8px 16px 18px",
    minHeight: "48px",
    borderRadius: "14px",
    border: "1px dashed rgba(255,255,255,0.18)",
    background: "transparent",
    color: "rgba(255,255,255,0.6)",
    fontSize: "15px",
    cursor: "pointer",
  },
  sheetBackdrop: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "flex-end",
    zIndex: 50,
  },
  sheet: {
    width: "100%",
    maxHeight: "90%",
    overflowY: "auto",
    background: "#161618",
    borderTopLeftRadius: "22px",
    borderTopRightRadius: "22px",
    padding: "12px 18px calc(28px + env(safe-area-inset-bottom, 0px))",
  },
  grabber: { width: "36px", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.25)", margin: "0 auto 14px" },
  label: { display: "block", fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.42)", textTransform: "uppercase", letterSpacing: "0.5px", margin: "14px 0 6px" },
  input: {
    width: "100%",
    padding: "14px 14px",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    fontSize: "16px",
    outline: "none",
  },
  primaryBtn: { width: "100%", minHeight: "48px", borderRadius: "14px", border: "none", background: "#fff", color: "#000", fontSize: "15px", fontWeight: 700, cursor: "pointer" },
  dangerBtn: { width: "100%", minHeight: "48px", borderRadius: "14px", border: "1px solid rgba(239,68,68,0.32)", background: "rgba(239,68,68,0.08)", color: "#f87171", fontSize: "15px", fontWeight: 600, cursor: "pointer", marginTop: "14px" },
  chip: { fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" },
  toast: {
    position: "fixed",
    left: "16px",
    right: "16px",
    bottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
    padding: "12px 16px",
    borderRadius: "14px",
    background: "#1f1f22",
    color: "#fff",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 60,
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/admin/styles.js
git commit -m "feat(admin): shared dark-theme styles"
```

---

## Task 6: Save status chip (`src/admin/SaveStatusChip.jsx`)

**Files:**
- Create: `src/admin/SaveStatusChip.jsx`

- [ ] **Step 1: Implement the component**

```jsx
import React from "react";
import { styles } from "./styles.js";

const LABELS = {
  idle: { text: "", color: "rgba(255,255,255,0.4)" },
  saving: { text: "Enregistrement…", color: "rgba(255,255,255,0.55)" },
  saved: { text: "Enregistré", color: "#22c55e" },
  error: { text: "Échec — touchez pour réessayer", color: "#f87171" },
};

export default function SaveStatusChip({ status, onRetry }) {
  const label = LABELS[status] || LABELS.idle;
  if (!label.text) return null;
  return (
    <button
      type="button"
      onClick={status === "error" ? onRetry : undefined}
      style={{ ...styles.chip, color: label.color, background: "transparent", border: "none", cursor: status === "error" ? "pointer" : "default" }}
    >
      {label.text}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/admin/SaveStatusChip.jsx
git commit -m "feat(admin): save status chip"
```

---

## Task 7: Service row (`src/admin/ServiceRow.jsx`)

**Files:**
- Create: `src/admin/ServiceRow.jsx`
- Test: `src/admin/ServiceRow.test.jsx`

Row shows thumbnail, name, a price pill (button → opens detail), and an on/off toggle. Toggling calls `onToggle`; tapping name/photo/price calls `onOpen`.

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ServiceRow from "./ServiceRow.jsx";

const svc = { id: 1, name: "Soin hydratant", price: 450, duration: "45m", image: "", description: "", visible: true };

describe("ServiceRow", () => {
  it("shows name and price and fires onToggle / onOpen", async () => {
    const onToggle = vi.fn();
    const onOpen = vi.fn();
    render(<ServiceRow service={svc} onToggle={onToggle} onOpen={onOpen} />);

    expect(screen.getByText("Soin hydratant")).toBeInTheDocument();
    expect(screen.getByText(/450/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByText(/450/));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("marks hidden services with aria-checked false", () => {
    render(<ServiceRow service={{ ...svc, visible: false }} onToggle={() => {}} onOpen={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/admin/ServiceRow.test.jsx`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement `src/admin/ServiceRow.jsx`**

```jsx
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/admin/ServiceRow.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/ServiceRow.jsx src/admin/ServiceRow.test.jsx
git commit -m "feat(admin): service row with inline price + toggle"
```

---

## Task 8: Category header (`src/admin/CategoryHeader.jsx`)

**Files:**
- Create: `src/admin/CategoryHeader.jsx`

- [ ] **Step 1: Implement the component**

```jsx
import React from "react";
import { styles } from "./styles.js";

export default function CategoryHeader({ category, count, collapsed, onToggleCollapse, onEdit }) {
  return (
    <div style={styles.catHeader}>
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        style={{ border: "none", background: "transparent", color: "inherit", font: "inherit", textTransform: "inherit", letterSpacing: "inherit", cursor: "pointer", flex: 1, textAlign: "left", padding: 0 }}
      >
        {collapsed ? "▸" : "▾"} {category.name} · {count}
      </button>
      <button type="button" onClick={onEdit} aria-label={`Modifier la categorie ${category.name}`} style={{ border: "none", background: "transparent", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "15px" }}>
        ✎
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/admin/CategoryHeader.jsx
git commit -m "feat(admin): collapsible category header"
```

---

## Task 9: Photo picker (`src/admin/PhotoPicker.jsx`)

**Files:**
- Create: `src/admin/PhotoPicker.jsx`

Wraps a file input (camera/gallery), uploads via `uploadPhoto`, calls `onUploaded(url)`. Falls back to a URL text field when no ImgBB key is configured.

- [ ] **Step 1: Implement the component**

```jsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/admin/PhotoPicker.jsx
git commit -m "feat(admin): photo picker (camera/gallery via ImgBB, URL fallback)"
```

---

## Task 10: Detail sheet (`src/admin/DetailSheet.jsx`)

**Files:**
- Create: `src/admin/DetailSheet.jsx`

Edits a service or a category. `target = { type: "service", catId, service } | { type: "category", category }`. Calls `onChange(updates)` per field and `onDelete()`; `onClose()` dismisses. Uses normal-flow backdrop (no `position: fixed`).

- [ ] **Step 1: Implement the component**

```jsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/admin/DetailSheet.jsx
git commit -m "feat(admin): detail sheet for service and category editing"
```

---

## Task 11: Search bar (`src/admin/SearchBar.jsx`)

**Files:**
- Create: `src/admin/SearchBar.jsx`

- [ ] **Step 1: Implement the component**

```jsx
import React from "react";
import { styles } from "./styles.js";

export default function SearchBar({ value, onChange }) {
  return (
    <div style={styles.search}>
      <span aria-hidden="true" style={{ color: "rgba(255,255,255,0.45)" }}>⌕</span>
      <input
        style={styles.searchInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rechercher un soin…"
        aria-label="Rechercher un soin"
        autoCapitalize="none"
        autoCorrect="off"
      />
      {value && (
        <button type="button" aria-label="Effacer" onClick={() => onChange("")} style={{ border: "none", background: "transparent", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>✕</button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/admin/SearchBar.jsx
git commit -m "feat(admin): search bar"
```

---

## Task 12: Menu editor screen (`src/admin/MenuEditor.jsx`)

**Files:**
- Create: `src/admin/MenuEditor.jsx`
- Test: `src/admin/MenuEditor.test.jsx`

Composes search + grouped list + add buttons + save chip + detail sheet, driven by `useAutosave`.

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./api.js", () => ({ callAdmin: vi.fn().mockResolvedValue({ ok: true }), IMGBB_KEY: "", uploadPhoto: vi.fn() }));

import MenuEditor from "./MenuEditor.jsx";

const data = {
  categories: [
    { id: "spa", name: "Head Spa", image: "", heroImage: "", visible: true, services: [
      { id: 1, name: "Royale", price: 600, duration: "1h", image: "", description: "", visible: true },
    ] },
    { id: "lift", name: "Lifting", image: "", heroImage: "", visible: true, services: [
      { id: 2, name: "Colombien", price: 150, duration: "1h", image: "", description: "", visible: true },
    ] },
  ],
};

describe("MenuEditor", () => {
  it("renders all services and filters by search", async () => {
    render(<MenuEditor initialData={data} password="p" />);
    expect(screen.getByText("Royale")).toBeInTheDocument();
    expect(screen.getByText("Colombien")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Rechercher un soin"), "colomb");
    expect(screen.queryByText("Royale")).not.toBeInTheDocument();
    expect(screen.getByText("Colombien")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/admin/MenuEditor.test.jsx`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement `src/admin/MenuEditor.jsx`**

```jsx
import React, { useState } from "react";
import { styles } from "./styles.js";
import { useAutosave } from "./useAutosave.js";
import * as D from "./data.js";
import SearchBar from "./SearchBar.jsx";
import CategoryHeader from "./CategoryHeader.jsx";
import ServiceRow from "./ServiceRow.jsx";
import DetailSheet from "./DetailSheet.jsx";
import SaveStatusChip from "./SaveStatusChip.jsx";

export default function MenuEditor({ initialData, password }) {
  const { data, status, mutate, undo, canUndo } = useAutosave({ initialData, password });
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState({});
  const [target, setTarget] = useState(null); // {type, catId, serviceId} reference

  const view = D.filterData(data, query);

  function openService(catId, serviceId) { setTarget({ type: "service", catId, serviceId }); }
  function openCategory(catId) { setTarget({ type: "category", catId }); }
  function closeSheet() { setTarget(null); }

  const liveCategory = target ? data.categories.find((c) => c.id === target.catId) : null;
  const liveService = target?.type === "service" && liveCategory ? (liveCategory.services || []).find((s) => s.id === target.serviceId) : null;

  function addServiceTo(catId) {
    const id = D.nextServiceId(data);
    const service = { id, name: "Nouveau soin", price: 0, duration: "1h", image: "", description: "", visible: true };
    mutate((d) => D.addService(d, catId, service));
    setTarget({ type: "service", catId, serviceId: id });
  }

  function addCategory() {
    const id = `cat-${Date.now()}`;
    mutate((d) => D.addCategory(d, { id, name: "Nouvelle catégorie", image: "", heroImage: "", visible: true, services: [] }));
    setTarget({ type: "category", catId: id });
  }

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <h1 style={styles.title}>Mes soins</h1>
        <SaveStatusChip status={status} onRetry={() => mutate((d) => ({ ...d }))} />
      </div>

      <SearchBar value={query} onChange={setQuery} />

      {view.categories.map((cat) => (
        <div key={cat.id}>
          <CategoryHeader
            category={cat}
            count={(cat.services || []).length}
            collapsed={!!collapsed[cat.id]}
            onToggleCollapse={() => setCollapsed((c) => ({ ...c, [cat.id]: !c[cat.id] }))}
            onEdit={() => openCategory(cat.id)}
          />
          {!collapsed[cat.id] && (cat.services || []).map((s) => (
            <ServiceRow
              key={s.id}
              service={s}
              onToggle={() => mutate((d) => D.updateService(d, cat.id, s.id, { visible: s.visible === false }))}
              onOpen={() => openService(cat.id, s.id)}
            />
          ))}
          {!collapsed[cat.id] && !query && (
            <button type="button" style={styles.addBtn} onClick={() => addServiceTo(cat.id)}>+ Ajouter un soin</button>
          )}
        </div>
      ))}

      {!query && (
        <button type="button" style={styles.addBtn} onClick={addCategory}>+ Ajouter une catégorie</button>
      )}

      {target?.type === "service" && liveService && (
        <DetailSheet
          target={{ type: "service", service: liveService }}
          onChange={(updates) => mutate((d) => D.updateService(d, target.catId, target.serviceId, updates))}
          onDelete={() => { mutate((d) => D.removeService(d, target.catId, target.serviceId)); closeSheet(); }}
          onClose={closeSheet}
        />
      )}
      {target?.type === "category" && liveCategory && (
        <DetailSheet
          target={{ type: "category", category: liveCategory }}
          onChange={(updates) => mutate((d) => D.updateCategory(d, target.catId, updates))}
          onDelete={() => { mutate((d) => D.removeCategory(d, target.catId)); closeSheet(); }}
          onClose={closeSheet}
        />
      )}

      {canUndo && (
        <div style={styles.toast}>
          <span>Modification enregistrée</span>
          <button type="button" onClick={undo} style={{ border: "none", background: "transparent", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Annuler</button>
        </div>
      )}

      <style>{`* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; } input, textarea { font-family: inherit; }`}</style>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/admin/MenuEditor.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/MenuEditor.jsx src/admin/MenuEditor.test.jsx
git commit -m "feat(admin): Mes soins editor screen with search, autosave, sheet"
```

---

## Task 13: Login screen (`src/admin/LoginScreen.jsx`)

**Files:**
- Create: `src/admin/LoginScreen.jsx`

Ported from today's `Admin.jsx` login (calls `callAdmin({action:"login"})`).

- [ ] **Step 1: Implement the component**

```jsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/admin/LoginScreen.jsx
git commit -m "feat(admin): login screen component"
```

---

## Task 14: App shell + wire-up (`src/admin/AdminApp.jsx`, `src/Admin.jsx`)

**Files:**
- Create: `src/admin/AdminApp.jsx`
- Modify: `src/Admin.jsx` (replace entire contents with a re-export)

- [ ] **Step 1: Implement `src/admin/AdminApp.jsx`**

```jsx
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
```

- [ ] **Step 2: Replace `src/Admin.jsx` with a re-export**

Replace the entire file contents with:
```jsx
export { default } from "./admin/AdminApp.jsx";
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — all suites green.

- [ ] **Step 4: Build to verify production bundles**

Run: `npm run build`
Expected: `✓ built` with no errors; an `Admin-*.js` chunk is emitted.

- [ ] **Step 5: Commit**

```bash
git add src/admin/AdminApp.jsx src/Admin.jsx
git commit -m "feat(admin): wire login + autoload + Mes soins editor; Admin.jsx re-exports AdminApp"
```

---

## Task 15: Manual verification & ship

**Files:** none (verification only)

- [ ] **Step 1: Run the dev server against this checkout**

Run: `npm run dev` and open the printed URL with `#admin`.
Expected: login screen renders.

- [ ] **Step 2: Verify the editor in the browser**

Log in (the function won't run under `vite dev`, so login will error — that's expected locally). To verify the editor UI itself, temporarily render `<MenuEditor>` with sample data, OR rely on the Netlify preview in Step 4 for the full flow. Confirm no console errors on the login screen.

- [ ] **Step 2b: Confirm tests + build are green**

Run: `npm test && npm run build`
Expected: all tests pass; build succeeds.

- [ ] **Step 3: Push the branch and open a PR**

```bash
git push -u origin menu-editor-impl
gh pr create --title "Menu editor UX redesign (Mes soins)" --body "Implements docs/superpowers/specs/2026-06-13-menu-editor-ux-design.md"
```

- [ ] **Step 4: Test on the Netlify deploy preview**

Open the preview URL Netlify posts on the PR, go to `/#admin`, log in with the existing `ADMIN_PASSWORD`. Verify:
- Search filters across categories.
- Tapping a price / row opens the sheet; editing a field shows `Enregistrement… → Enregistré`.
- Toggling a service on/off persists (reload the preview, state holds after the deploy completes).
- "Annuler" (undo) reverts the last change.
- If `VITE_IMGBB_KEY` is set, the photo picker uploads; otherwise the URL fallback shows.

- [ ] **Step 5: Set `VITE_IMGBB_KEY` (optional) for photo uploads**

If photo upload is wanted, add `VITE_IMGBB_KEY` in Netlify env vars (any context) and redeploy.

- [ ] **Step 6: Merge to go live**

Merge the PR once the preview checks out. Production deploys automatically.

---

## Self-review notes (author)

- Spec coverage: search (Task 12), inline price + toggle (Task 7/12), detail sheet incl. delete+undo (Task 10/12/4), add service/category (Task 12), categories edit (Task 10/12), autosave + status + undo (Task 4/6/12), photos via `VITE_IMGBB_KEY` with URL fallback (Task 9), login unchanged (Task 13/14), public menu untouched (no `App.jsx` task). Covered.
- Non-goals respected: no drag-reorder, no rich text, no multi-user.
- Type consistency: `useAutosave({initialData,password,delay})` → `{data,status,mutate,undo,canUndo}` used consistently in Task 12; data helpers signatures match Task 2 usage in Task 12.
