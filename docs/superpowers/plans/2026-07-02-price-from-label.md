# "À partir de" Price Label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show "à partir de" as a small tracked-uppercase eyebrow above every service price in the two customer-facing views.

**Architecture:** Presentation-only change to `src/App.jsx`. Add one module-level text constant, then insert an eyebrow `<span>` above the price in `MenuItem` (menu list) and `StoryViewer` (fullscreen detail). No data model, admin, or `data.json` change.

**Tech Stack:** React 18, Vite, inline-style JSX (the file's existing convention).

## Global Constraints

- Exact wording: `à partir de` (lowercase in source; CSS `textTransform: "uppercase"` renders it as `À PARTIR DE`).
- Applies to every price — no per-service/per-category logic.
- Customer-facing views only: `MenuItem` and `StoryViewer`. Do NOT touch the admin (`ServiceRow`, `DetailSheet`) or `data.json`.
- Price number, `DH`, and duration keep their current size, weight, and color — the price stays the hero.
- Eyebrow style tokens: `fontSize "11px"`, `textTransform "uppercase"`, `color "rgba(255,255,255,0.4)"`. Per-spot: list uses `letterSpacing "1.4px"` / `marginBottom "4px"`; detail uses `letterSpacing "2px"` / `marginBottom "8px"`.
- No new dependencies. No new files.

## File Structure

- Modify: `src/App.jsx`
  - Add `PRICE_FROM_LABEL` constant after the imports.
  - `MenuItem` price block (currently lines 571–595): add eyebrow, restack price into a column, change row `alignItems` to `flex-end`.
  - `StoryViewer` price block (currently lines 326–348): insert eyebrow line above the price+duration row.

No test files — `src/App.jsx` has no existing test harness and this is a visual change. Each task is verified in the browser preview.

**Verification prerequisite (both tasks):** a dev server must be running. If none is up, start one (`vite-dev` on port 5173 is enough for the public menu). The public menu is at the site root; open a category to reach the list, then tap a service to reach the detail.

---

### Task 1: Add constant + eyebrow in the menu list (`MenuItem`)

**Files:**
- Modify: `src/App.jsx` (imports area; `MenuItem` price block at lines 571–595)

**Interfaces:**
- Produces: module-level `const PRICE_FROM_LABEL = "à partir de";` — reused by Task 2.

- [ ] **Step 1: Add the text constant**

In `src/App.jsx`, immediately after the import line `import { galleryImages } from "./admin/data.js";` (line 2), insert a blank line and:

```jsx
const PRICE_FROM_LABEL = "à partir de";
```

- [ ] **Step 2: Replace the `MenuItem` price block**

Replace the entire block currently at lines 571–595:

```jsx
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          marginTop: "10px",
        }}>
          <span style={{
            fontSize: "18px", fontWeight: 700, color: "#fff",
            letterSpacing: "-0.5px",
          }}>
            {service.price}
            <span style={{
              fontSize: "11px", fontWeight: 500,
              color: "rgba(255,255,255,0.35)", marginLeft: "2px",
            }}>DH</span>
          </span>

          <div style={{
            padding: "4px 10px", borderRadius: "100px",
            background: "rgba(255,255,255,0.06)",
            fontSize: "12px", fontWeight: 500,
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.3px",
          }}>
            {service.duration}
          </div>
        </div>
```

with:

```jsx
        <div style={{
          display: "flex", alignItems: "flex-end", gap: "10px",
          marginTop: "10px",
        }}>
          <span style={{ display: "flex", flexDirection: "column" }}>
            <span style={{
              fontSize: "11px", letterSpacing: "1.4px", textTransform: "uppercase",
              color: "rgba(255,255,255,0.4)", lineHeight: 1, marginBottom: "4px",
            }}>
              {PRICE_FROM_LABEL}
            </span>
            <span style={{
              fontSize: "18px", fontWeight: 700, color: "#fff",
              letterSpacing: "-0.5px", lineHeight: 1,
            }}>
              {service.price}
              <span style={{
                fontSize: "11px", fontWeight: 500,
                color: "rgba(255,255,255,0.35)", marginLeft: "2px",
              }}>DH</span>
            </span>
          </span>

          <div style={{
            padding: "4px 10px", borderRadius: "100px",
            background: "rgba(255,255,255,0.06)",
            fontSize: "12px", fontWeight: 500,
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.3px",
          }}>
            {service.duration}
          </div>
        </div>
```

- [ ] **Step 3: Verify in the browser preview**

Ensure a dev server is running. Navigate to the public menu, open any category (e.g. "Head Spa") to show the service list.

Expected: each row shows a small uppercase `À PARTIR DE` directly above the bold price (e.g. `À PARTIR DE` over `600 DH`), with the duration pill still aligned to the bottom of the price. The price number, `DH`, and pill are unchanged in size/weight. No wrapping or overflow on a mobile-width viewport (resize to 375px to check).

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: show 'à partir de' above price in menu list"
```

---

### Task 2: Add eyebrow in the fullscreen detail (`StoryViewer`)

**Files:**
- Modify: `src/App.jsx` (`StoryViewer` price block at lines 326–348)

**Interfaces:**
- Consumes: `PRICE_FROM_LABEL` from Task 1.

- [ ] **Step 1: Insert the eyebrow above the price+duration row**

In the `StoryViewer` service-info overlay, find this block (currently starting at line 326):

```jsx
          {/* Price + duration — bold and clear */}
          <div style={{
            display: "flex", gap: "10px", marginBottom: "18px",
            alignItems: "baseline",
          }}>
```

Insert the eyebrow `<span>` between the comment and the `<div>`, so it reads:

```jsx
          {/* Price + duration — bold and clear */}
          <span style={{
            display: "block",
            fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase",
            color: "rgba(255,255,255,0.4)", marginBottom: "8px",
          }}>
            {PRICE_FROM_LABEL}
          </span>
          <div style={{
            display: "flex", gap: "10px", marginBottom: "18px",
            alignItems: "baseline",
          }}>
```

Leave the rest of the block (the 36px price span, the divider, the duration span, and the closing `</div>`) unchanged.

- [ ] **Step 2: Verify in the browser preview**

With the dev server running, navigate to the public menu → open a category → tap a service to open the fullscreen story detail.

Expected: a small uppercase `À PARTIR DE` line appears directly above the large `600 DH` price. The 36px price, `DH`, the vertical divider, and the duration are all unchanged. Verify at mobile width (375px) — no overflow, eyebrow left-aligned with the price.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: show 'à partir de' above price in service detail"
```

---

## Self-Review

**Spec coverage:**
- "Every price, customer views only" → Task 1 (list) + Task 2 (detail); admin untouched (not in any task). ✓
- Shared constant `PRICE_FROM_LABEL` → Task 1 Step 1, consumed in Task 2. ✓
- Tracked-eyebrow treatment + exact style tokens → Global Constraints + both task code blocks. ✓
- List alignment change (`center` → `flex-end`) → Task 1 Step 2. ✓
- No data/admin change → Global Constraints + File Structure. ✓
- Visual verification (no test harness) → each task's verify step. ✓

**Placeholder scan:** No TBD/TODO; every code block is complete and literal. ✓

**Type consistency:** `PRICE_FROM_LABEL` defined once (Task 1) and referenced identically in Task 2. Style token values match the spec verbatim. ✓
