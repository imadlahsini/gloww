# Per-service photo gallery — implementation plan

> Date: 2026-06-14 · Status: Designed (awaiting approval). Produced by a design workflow (3 design lenses → 2 adversarial critics → synthesis; 18 issues resolved).

**Data-model decision (the contract):** add an optional `images: string[]` to a service. Invariant `image === images[0]` whenever a gallery exists; `images` is OMITTED (not `[]`) when a service has 0 or 1 photos, so the 87 existing services stay byte-identical and need no migration. The public story gallery is derived: `galleryImages(service) = service.images?.length ? service.images : (service.image ? [service.image] : [])`. The cover is always the first photo; reordering (promote to index 0) is the only way to change the cover.

## Goal
Replace StoryViewer's fake picsum seed-variants with a real per-service photo gallery (`images: string[]`), editable in the admin, with the single `image` field kept as cover so every existing consumer keeps working and the 87 legacy services need no migration.

---

## Final data model

A service is unchanged except for ONE new optional field:

```jsonc
{ "id": 1, "name": "Royale Head Spa", "price": 600, "duration": "1h",
  "image": "https://...",            // cover/thumbnail — ALWAYS present, source of truth for orbit/list/admin-row
  "images": ["https://...","https://..."],  // OPTIONAL ordered gallery; present ONLY when >= 2 photos
  "description": "...", "visible": true }
```

**Consistency rule (the only two invariants):**
1. **`image === images[0]`** whenever `images` exists and is non-empty. The cover is the first gallery photo. Promoting a photo to index 0 IS how you change the cover — there is no separate "set cover" slot, so they can never diverge.
2. **`images` is OMITTED** (the key is absent, never `[]`) when a service has 0 or 1 photos. A legacy service with only `image` stays byte-identical on disk.

**Derived gallery (single shared helper, used by BOTH public viewer and admin):**
```js
export function galleryImages(service) {
  return (Array.isArray(service?.images) && service.images.length)
    ? service.images
    : (service?.image ? [service.image] : []);
}
```
- Returns the real `images` array when present; otherwise falls back to `[image]`; otherwise `[]`.
- **No Set de-dup** and **no independent-cover/prepend logic** (rejects the public sub-design's `Array.from(new Set(...))` and "image not a member of images" model — they conflict with invariant 1 and could silently drop a slide or desync `images.length` from what the admin sees).

**Legacy fallback:** because invariant 2 keeps `images` absent for the 87 existing services, `galleryImages` returns `[image]` for each — exactly one real photo per story, zero fakes, zero migration.

---

## Files to change

### 1. `src/admin/data.js`
Add a shared `galleryImages(service)` helper and a single `setServiceImages` writer. Both pure/immutable. `setServiceImages` delegates to the EXISTING `updateService` (no signature change).
```js
export function galleryImages(service) {
  return (Array.isArray(service?.images) && service.images.length)
    ? service.images
    : (service?.image ? [service.image] : []);
}

// The ONLY writer for galleries. Enforces both invariants in one place.
export function setServiceImages(data, catId, serviceId, images) {
  const clean = (images || []).filter(Boolean);    // drop empty/falsy URLs
  const updates = clean.length >= 2
    ? { image: clean[0], images: clean }            // >=2 photos: cover = first, keep array
    : { image: clean[0] || "", images: undefined }; // 0 or 1: only image, clear images key
  return updateService(data, catId, serviceId, updates);
}
```
`images: undefined` is safe — both `callAdmin` (api.js `JSON.stringify(body)`) and the Netlify function (`JSON.stringify(body.data, null, 2)`) drop undefined keys end-to-end (verified).

### 2. `src/App.jsx`
- **Delete `getServiceImages` (lines 93-102)** — the picsum seed-variant fabricator, the only fake-image source.
- **Import the shared helper:** `import { galleryImages } from "./admin/data.js";` (data.js is dependency-free, safe in the public bundle) — guarantees the field name can't drift between admin and public.
- **Line 108:** `const images = galleryImages(service);` (`count = images.length` unchanged).
- **Progress RAF effect (line 136):** add `if (count === 0) { setProgress(0); return; }` at the top.
- **Image render (lines 308-316):** render via `SafeImage` (with a gradient placeholder when no URL) instead of raw `<img>`.
- **Image counter (377-383)** and **TapHints (387):** wrap in `{count > 1 && ( ... )}`.
- **StoryViewer call site (line 1232):** add `key={selectedService.id}` so per-service state (current/progress) resets between services and a stale out-of-bounds `current` can't occur.
- **Harden `SafeImage` (54-91):** start in `"error"` when `!src` so an empty `image` shows the ✦ placeholder, not a perpetual spinner.
- **No change** at 499, 555, 680, 1175 (they read `category.image`/`service.image`/`category.heroImage`).

### 3. `src/admin/DetailSheet.jsx`
Replace the single `PhotoPicker` in the SERVICE branch with a horizontal thumbnail strip + add tile, all writing through a new `onSetImages(nextArray)` prop. Category branch untouched.
- Strip renders `galleryImages(s)`; index 0 shows a "Couverture" badge; others show a ★ (move-to-front → cover); each has a **two-tap delete** (× → "Confirmer ?" for ~3s) since the undo toast is invisible while the sheet is open.
- `moveToFront(arr, i) = [arr[i], ...arr.filter((_, j) => j !== i)]`.
- Add tile appends an uploaded URL: `onSetImages([...gallery, url])`.

### 4. `src/admin/PhotoPicker.jsx`
Add an exported `AddPhotoTile` that reuses `uploadPhoto` + `IMGBB_KEY` URL-fallback but calls `onAdd(url)` (append) instead of replacing. Existing `PhotoPicker` stays for category icon/banner. `onAdd` fires only after the upload resolves.

### 5. `src/admin/styles.js`
Add: `galleryStrip` (flex, gap 8px, overflowX auto, touch scroll), `galleryThumb` (88px square, cover), `galleryItem(isCover)` (relative, 88px, flexShrink 0, 2px white ring when cover), `coverBadge`, `coverBtn`/`removeBtn` (≥44px targets; × top-right, ★ bottom-left to avoid mis-taps), `addTile` (88px dashed square). Dark-sheet tokens.

### 6. `src/admin/MenuEditor.jsx`
On the service `DetailSheet` instance, add one prop through `editTarget` (so autosave/undo/new-item-kept all work unchanged):
```jsx
onSetImages={(imgs) => editTarget((d) => D.setServiceImages(d, target.catId, target.serviceId, imgs))}
```
No change to the new-service literal (stays `image: ""`, no `images`), `useAutosave.js`, or the category sheet.

### 7. `src/admin/data.test.js`
Add tests for `galleryImages` and `setServiceImages` (assert on the SERIALIZED form, `JSON.parse(JSON.stringify(next))`).

### 8. `public/data.json`
No migration. The 87 services stay byte-identical; a service gains `images` only when an admin adds a 2nd photo.

---

## Backward compatibility — the 87 existing single-image services
- All 87 have a picsum `image` and no `images` key. `galleryImages` returns `[image]` → every story shows exactly ONE real photo, no fakes. No migration.
- Orbit (499, 1175), list thumbnail (555), category hero (680) are untouched.
- **⚠️ ROLLOUT SIGN-OFF REQUIRED:** today each story shows 4 fabricated picsum variants. On deploy, every one of the 87 services drops from 4 slides to **1 real photo** until the owner adds more. Intended, but a visible change — confirm before shipping.

---

## Edge cases and handling
1. **1 photo:** single full-width progress bar fills once then idles; counter hidden, TapHints hidden, left tap no-op, right tap closes. `setServiceImages` writes only `image`.
2. **0 photos** (new `image:""` service opened publicly): RAF guard prevents the tick; gradient placeholder renders; right tap closes. No crash.
3. **Removing the cover (index 0):** new `images[0]` becomes the cover; `image` updates to match (auto-promote-next). Two-tap confirm prevents accidental loss.
4. **Removing the last photo:** array `[]` → `image:""`, `images:undefined`; service stays editable; SafeImage shows the placeholder everywhere, not a spinner.
5. **Empty/new gallery in admin:** strip shows only the add tile; first photo becomes cover automatically.
6. **Duplicate/empty URLs:** `filter(Boolean)` drops empties; duplicates allowed (React key `url+i`); no de-dup so `images.length` matches the admin.
7. **Autosave/undo:** each `onSetImages` = one `mutate()` = one autosave + one undo step. Undo toast invisible while sheet open → mitigated by two-tap delete. No ★ rendered for index 0 (no no-op mutation).
8. **`images:undefined` persistence:** dropped client- and server-side; tests assert on serialized form.

---

## Ordered, bite-sized tasks

**A. data.js logic — test-first**
1. Add `galleryImages` tests: `[image]` for legacy; the array when present; `[]` when neither.
2. Add `setServiceImages` tests (assert serialized): 2+ URLs → `image===images[0]` & `images` equals input; 1 URL → `image` set, NO `images` key; `[]` → `image:""`, NO `images`; `["",url]` → `image:url`, no `images`; input not mutated.
3. `npm test` — watch new tests FAIL.
4. Implement `galleryImages` + `setServiceImages`; `npm test` green (existing 7 data tests unaffected — `updateService` unchanged).

**B. Public viewer (App.jsx)**
5. Delete `getServiceImages`; add the `galleryImages` import.
6. Line 108 → `galleryImages(service)`.
7. `if (count === 0) { setProgress(0); return; }` atop the progress effect.
8. Raw `<img>` → conditional `SafeImage` + placeholder.
9. Wrap counter + TapHints in `{count > 1 && ...}`.
10. Add `key={selectedService.id}` to StoryViewer.
11. Harden `SafeImage` (start `"error"` when `!src`).

**C. Admin UI**
12. `AddPhotoTile` in PhotoPicker.jsx.
13. Gallery styles in styles.js.
14. Rewrite the service branch of DetailSheet.jsx (strip + ★ cover + two-tap × + add tile via `onSetImages`).
15. Wire `onSetImages` on the service DetailSheet in MenuEditor.jsx via `editTarget` → `D.setServiceImages`.

**D. Build + manual verify**
16. `npm test` (green), `npm run build` (clean).
17. Public: legacy → 1 real photo (no counter/hints, right-tap closes); multi-photo → tap nav + per-segment bars + counter; switch services without closing → no stale slide.
18. Admin: add 2nd photo to a legacy service (→ `images` len 2, `image===images[0]`); ★ promotes cover (orbit/list thumbnail follows); two-tap × removes; remove all → `image:""`, placeholder, no spinner; reload → `data.json` round-trips (no stray `images` on ≤1-photo services).

---

## Out of scope (YAGNI)
Drag-and-drop reorder (★ "make cover" is the only ordering primitive), category galleries, a max photo count, and hiding new `image:""` services from the public site.
