# Own Family Tree

A **local-first** family tree viewer: plain HTML + CSS + JS, **no server, no build step**.
Designed to be opened by clicking family-tree.html.

Design decisions:
- Local first. Self contained inside a folder/directory.
- Runs on a browser without a server.
- The folder is copyable to facilitate permanent storage and sharing (e.g. via SD card)
- Supports rich media: audio, photo, video, links and informational texts.
- No build/compile step
- Coming soon: ability to back up to a server.
- Coming soon: developer friendly: ability to customize it + API

## Hard constraints (do not break)
- **No server / no build tooling.** It must launch by double-clicking the family-tree.html file.
- **All paths must stay relative.** No absolute paths, no leading `/`.
- Must keep working under `file://` across all browsers.

## Structure & paths
```
family-tree.html          <- ONLY file at root; the one the user clicks
web/                      <- all other html/css/js live here
  family-tree.css / .js   <- main page assets
  detail.html / .css / .js
  edit-tree.html/.css/.js <- single-page tree editor (add/edit/delete people)
data/family.js            <- window.FAMILY_DATA (edit data here)
media/photos/<id>.jpg     <- per-person photos (currently one sample file)
```
- Root file `family-tree.html` references assets as `data/...`, `web/...`, `media/...`.
- Per-page asset naming: `<page>.css` / `<page>.js`.

## Data loading (important)
- The single source of truth is `data/family.js`, which assigns `window.FAMILY_DATA = { ... }`.
  The object is **pure JSON**; edit it like JSON.
- It is a **`.js` file, not `.json`, on purpose**: browsers block `fetch()`, `XMLHttpRequest`,
  and ES-module `import` of local files via `file://` (CORS) in Chrome/Safari/Edge.
  Loading via `<script src>` is the only cross-browser method. **Do not switch to fetch/JSON.**
- A clean `.json` is produced **on demand** by the "Download .json" action (a Blob download).
  The browser cannot write to `data/` directly, so there is no stored `.json` file to keep in sync.


WHEN EDITING THIS FILE:
  - Be brief
  - Only add architectural/design decisions that add value and are hard to deduce from code