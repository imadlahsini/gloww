# Menu editor UX redesign — design spec

Date: 2026-06-13
Status: Approved (design); implementation plan pending
Scope: The `#admin` editing experience only. The public customer menu and the
password login (Netlify function) are unchanged.

## Problem

The current admin is a nested CRUD flow: Categories list → tap a category →
Services list → tap a service → full-screen form. For the actual editor —
Salwa, the salon owner, non-technical, editing one-handed on her phone across
~95 services in 10 categories — this is slow to navigate, heavy on typing, and
sprinkled with developer concepts (a manual "Sauver/Publier" step, image URLs,
identifiers). She edits everything roughly equally: prices, availability
(on/off), adding/removing and renaming, and photos.

## Goals

- Find any service in 1–2 taps (search), regardless of which category it's in.
- Change the two most common things — price and on/off — without leaving the
  list and without a keyboard beyond a number pad.
- No developer jargon anywhere: no "publish", no URLs, no IDs.
- Forgiving: nothing is ever "lost", and destructive actions are undoable.
- Big, thumb-friendly targets; plain French.

## Non-goals (v1 — YAGNI)

- Drag-to-reorder services/categories.
- Multiple simultaneous editors / roles.
- Rich-text descriptions.
- Analytics or usage reporting.

## The user

Salwa — non-technical, phone, one hand, edits occasionally but touches the full
range of fields. Optimize for recognition over recall and for the fewest taps
on the common path.

## Chosen direction

A single **search-first editing screen** ("Mes soins") that lists every service
grouped under collapsible category headers, with inline quick-edits in each row
and a slide-up sheet for deeper edits. (Chosen over a WYSIWYG "edit on the live
menu" approach, which is delightful but slow to navigate and expensive to build
at 95 items, and over a light upgrade of the current screens, which leaves
findability unsolved.)

## Screens & components

### 1. Main screen — "Mes soins"

- **Search bar** (sticky, top): filters all services as she types, across every
  category. Primary findability mechanism.
- **Category headers**: e.g. `Soin Visage · 9`. Tap to collapse/expand. A
  trailing edit affordance opens category settings (§4).
- **Service row**: thumbnail · name · **tap-to-edit price pill** (opens a number
  pad only) · **on/off toggle**. Hidden services render dimmed + struck-through
  so "what's off" is obvious at a glance.
- **Add affordances**: `+ Ajouter un soin` under each category; `+ Ajouter une
  catégorie` at the bottom.
- **Save status chip** (top): `Enregistrement… → Enregistré` (see §5).

### 2. Service detail sheet (tap a row)

A bottom sheet slides up; dismiss by swiping down. Big fields:

- Photo (camera/gallery — §6)
- Name
- Price
- Durée
- Description
- `Supprimer` — removes with an **undo** affordance (toast with "Annuler"),
  not a blocking confirm dialog.

### 3. Adding

- `+ Ajouter un soin` inserts a new row in that category (pre-filled defaults)
  and opens the detail sheet focused on the name.
- `+ Ajouter une catégorie` asks only for a name + photo to start.
- No IDs or URLs are ever surfaced; IDs are generated internally as today.

### 4. Categories

Same sheet pattern as services: name, round icon photo, banner (hero) photo,
hide/show. Managed inline from the main screen.

### 5. Save model — autosave (approved)

- Optimistic: edits apply to local state instantly.
- **Debounced autosave**: ~2–3s after the last change, accumulated edits are
  committed in a single call to the existing admin function (`action: "save"`,
  which PUTs the full `data.json` to GitHub). A flurry of edits collapses into
  one commit.
- Status chip communicates state (`Enregistrement…` / `Enregistré` / a gentle
  retry on failure). No "Sauver"/"Publier" button.
- **Undo** reverts the last change locally and re-triggers autosave.
- Propagation: each committed batch is a real Netlify deploy; the live site
  reflects changes within ~30s. This is acceptable on Netlify build limits;
  the cost is a noisier commit history than today's one-button model.

### 6. Photos — real picker

- Tap photo → device-native **camera or gallery** (`<input type="file"
  accept="image/*">`, with capture hint on mobile).
- Upload path (decided): ImgBB via `VITE_IMGBB_KEY` — already wired in the
  shipped code, a low-stakes host key baked at build time. Chosen because it
  avoids the serverless function's ~6MB request-size limit on photo uploads.
  Alternative, only if zero keys in the bundle is required: proxy uploads
  through the admin function (adds base64/size handling).
- Fallback when no image host is configured: paste-a-link stays available.

## Technical approach

- Refactor `src/Admin.jsx` into the new IA. Reuse the existing serverless admin
  function (`netlify/functions/admin.js`) unchanged — autosave just calls its
  `save` action on a debounce instead of on a button press.
- Data model is unchanged: `categories[]` each with `{id, name, image,
  heroImage, visible, services[]}`; `services[]` each with `{id, name, price,
  duration, image, description, visible}`.
- Keep components small and single-purpose (list, row, category header, detail
  sheet, search, save-status). Favor a flat list derived from the grouped data
  for search/filtering.
- Language: French, plain wording; large tap targets; number pad for price.

## Unchanged

- Password login via the Netlify function (already shipped).
- The entire public customer menu (`src/App.jsx`).

## Risks / open items

1. **Autosave commit frequency** — debounce window tuning; consider a max-rate
   guard so rapid sessions don't create excessive deploys.
2. **Search over ~95 items** — client-side filter on the in-memory data is
   sufficient at this scale; no backend search needed.
