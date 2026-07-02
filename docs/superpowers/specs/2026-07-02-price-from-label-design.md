# "À partir de" price label — design

**Date:** 2026-07-02
**Status:** Approved (design), pending implementation plan

## Goal

Show the French phrase "à partir de" ("starting from") before every service
price in the customer-facing views, signalling that prices are a starting
point rather than fixed.

## Scope decisions (locked)

- **Which prices:** every price. No per-service or per-category control.
- **Where:** customer-facing views only — the public menu list and the
  fullscreen service detail. The admin editor is untouched (its price is an
  edit control, not a display).
- **Data model:** no change. `service.price` stays a plain number. This is a
  presentation-only change.
- **Wording:** exactly `à partir de` (not the shorter `dès`).

## Visual treatment — "tracked eyebrow"

The phrase renders as a small, uppercase, letter-spaced micro-label — the same
treatment the app already uses for `BIENVENUE`, `ADMINISTRATION`, and
`TOUCHER POUR OUVRIR`. This makes it read as part of the existing design
system rather than a generic grey caption. The price, `DH`, and duration keep
their current size and weight — the price stays the visual hero.

Source text is lowercase `à partir de`; CSS `text-transform: uppercase`
renders it as `À PARTIR DE` (the accented `à` uppercases to `À`).

### Shared constant

Define one module-level constant in `src/App.jsx` so the phrase lives in a
single place:

```js
const PRICE_FROM_LABEL = "à partir de";
```

Both render sites reference it. Styling stays inline, matching the file's
existing inline-style convention.

### Location 1 — public menu list (`MenuItem`, src/App.jsx ~575)

The price currently sits on one line next to the duration pill. Add the
eyebrow as a line above the price, stacked in a column:

- eyebrow: `fontSize 11px`, `letterSpacing 1.4px`, `textTransform uppercase`,
  `color rgba(255,255,255,0.4)`, `lineHeight 1`, `marginBottom 4px`
- the price `<span>` (bold 18px) and `DH` are unchanged, wrapped with the
  eyebrow in a `flex-direction: column` container
- the row that holds price-column + duration pill switches from
  `alignItems: "center"` to `alignItems: "flex-end"` so the price baseline
  lines up with the duration pill

### Location 2 — fullscreen detail (`StoryViewer`, src/App.jsx ~326)

Add the eyebrow as a line above the existing price + divider + duration row:

- eyebrow: `fontSize 11px`, `letterSpacing 2px`, `textTransform uppercase`,
  `color rgba(255,255,255,0.4)`, `marginBottom 8px`, block display
- the existing 36px price / divider / duration flex row is unchanged; the
  eyebrow is inserted directly above it inside the same info block

## Non-goals

- No change to the admin editor (`ServiceRow`, `DetailSheet`).
- No new data field, migration, or `data.json` change.
- No per-service or per-category toggle.
- No change to price/`DH`/duration sizing or weight.

## Verification

App.jsx (the public component) has no existing test harness, and this is a
visual, display-only change. Verify by running the local dev server and
checking both views:

- menu list row shows `À PARTIR DE` above `600 DH`, duration pill still aligned
- fullscreen detail shows `À PARTIR DE` above the large `600 DH`
- price, `DH`, and duration are unchanged in size/weight
- no layout wrap or overflow on a narrow (mobile) viewport

## Files touched

- `src/App.jsx` — add `PRICE_FROM_LABEL` constant; add eyebrow in `MenuItem`
  and `StoryViewer`.
