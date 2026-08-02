# Own Family Tree

A **local-first** family tree viewer: plain HTML + CSS + JS, **no server, no build step**.
Designed to be opened by clicking family-tree.html.

Design decisions:
- Local first. Self contained inside a folder/directory.
- Runs on a browser without a server.
- The folder is copyable to facilitate permanent storage and sharing (e.g. via SD card)
- Supports rich media: audio, photo, video, links and informational texts.
- Coming soon: ability to back up to a server.
- Coming soon: developer friendly: ability to customize it + API

## Hard constraints (do not break)
- **No server / no build tooling.** It must launch by double-clicking the family-tree.html file.
- **All paths must stay relative.** No absolute paths, no leading `/`.
- Must keep working under `file://` across all browsers.

## Data loading (important)
- The single source of truth is `data/family.js`, which assigns `window.FAMILY_DATA = { ... }`.
  The object is **pure JSON**; edit it like JSON.
- It is a **`.js` file, not `.json`, on purpose**: browsers block `fetch()`, `XMLHttpRequest`,
  and ES-module `import` of local files via `file://` (CORS) in Chrome/Safari/Edge.
  Loading via `<script src>` is the only cross-browser method. **Do not switch to fetch/JSON.**
- A clean `.json` is produced **on demand** by the "Download .json" action (a Blob download).
  The browser cannot write to `data/` directly, so there is no stored `.json` file to keep in sync.

## Structure & paths
```
family-tree.html          <- ONLY file at root; the one the user clicks
web/                      <- all other html/css/js live here
  family-tree.css / .js   <- main page assets
  detail.html / .css / .js
data/family.js            <- window.FAMILY_DATA (edit data here)
media/photos/<id>.jpg     <- per-person photos (currently one sample file)
```
- Root file `family-tree.html` references assets as `data/...`, `web/...`, `media/...`.
- Files in `web/` reference data/media one level up: `../data/...`, `../media/...`.
  (`detail.html?id=<id>` is the per-person page; it reads `?id` and looks up `FAMILY_DATA`.)
- Per-page asset naming: `<page>.css` / `<page>.js`. No shared `app.*` file (kept simple/explicit).

## Main page = pan/zoom family-tree canvas
- `family-tree.html` shows the tree on a **transform-based infinite canvas** (NOT `<canvas>`):
  a `#tree-world` div gets `transform: translate()+scale()`; nodes are real DOM `<a>` links
  (so photos + click-to-detail work), and an SVG layer (`#tree-edges`) draws the connectors.
  Chosen over `<canvas>` so images/links/hit-testing come for free.
- Pan = drag, zoom = wheel / +,-,fit buttons. A drag suppresses the following click so panning
  doesn't navigate. Raw JSON moved into a collapsible `<details>` below the canvas.
- Layout (`computeLayout` in family-tree.js): parents are derived from the `children` field
  (reverse lookup), NOT `ancestors` (which lists ALL ancestors). Spouses are grouped into
  "units" (couples) placed side by side; units form a tree; leaves get columns and parents
  center over their children. Tune via NODE_W/NODE_H/ROW/COL/COUPLE_GAP constants.
- Node photo uses the same fallback chain as the detail page (`<id>.jpg` -> sample -> SVG).

## Photos
- Detail page tries `media/photos/<id>.jpg`, then falls back to the existing sample photo
  (`PXL_20260617_003846295.jpg`), then to an inline SVG "No photo" placeholder.
- To give a person their own photo: drop `media/photos/<their-id>.jpg`.

## Data schema (person)
`id, first_name, middle_name, last_name, gender, dob (YYYY-MM-DD), birth_country,`
`ancestors: [id...], children: [id...], spouses: [{ id, date }]`

## Actions menu (main page, top-right)
- "Download .json" — active (Blob download of pure JSON).
- "Download GEDCOM" / "Backup" — disabled placeholders ("Coming soon"). Wire these up when ready.
