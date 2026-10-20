# WebPen Presenter - Internal Project Tracker

Working log for this repo: what shipped, what is in flight, what is next. Update this
file in the same commit as the work it describes.

---

## Project Overview

A single-file drawing overlay (`src/presenter.js`) plus two carriers: a bookmarklet page
and a Chrome / Edge extension. Origin: the presenter overlay of the Statistics Lessons
site (https://statistics-lessons.netlify.app), where the file is also deployed at
`/shared/presenter.js`.

---

## Completed

### 2026-10-20 - Extension tested on five sites; shadow root, window capture, iframes

- Test rig (kept outside the repo, in the session scratchpad): Playwright drives the
  bundled Chromium with `--load-extension` (branded Chrome 137+ ignores that flag, so the
  harness must use Playwright's Chromium), toggles the bar the way the toolbar button
  does (a message to the top frame from the service worker), dispatches synthetic
  PointerEvents of pointerType "pen" and "mouse", and reads pixels back from the overlay
  canvas. Local pages cover a sticky header at z-index 9999, a global
  `button{display:block;width:100%}` rule, a page that listens to pointerdown on
  document, a body with a transform, and a page with a same-origin and a cross-origin
  (YouTube) iframe. Live sites: Wikipedia, BBC News, Excalidraw, GeoGebra calculator.
  MDN was unreachable from this machine (connection reset, also with curl), not a bug.
- What broke and the fix, all in `src/presenter.js`:
  - The page's own `button` CSS restyled the bar (buttons 588 px wide, bar 364 px tall).
    The canvas and the dock now live in an open shadow root on one `div.presenter-host`
    appended to `<html>`, with `:host{all:initial}` so nothing inherits in either. The
    host carries the only z-index (`Z_INDEX`); canvas and dock stack inside it. Appending
    to `<html>` instead of `<body>` also survives a transformed body, which otherwise
    pins position: fixed to the page.
  - A page that registered a capture listener on `document` before the overlay saw every
    pen event. Input listeners moved from `document` to `window` (capture), which runs
    first; `isUi()` reads `composedPath()[0]` because events from the shadow tree reach
    window retargeted to the host.
  - A pen over an iframe never reached the top document. The extension now injects in
    every frame (`all_frames`); inside a frame the script builds no UI, captures the pen
    with the same rules and forwards the points to the parent with postMessage, which
    maps them through the iframe's box and draws (top) or forwards again (nested). The
    frame learns on/off and mode only through `Presenter.frameState()`, fed by
    `content.js` from the top frame through the service worker, never from postMessage,
    so a page cannot switch the capture on or read pen positions inside an embed unless
    the instructor turned the bar on. Laser taps inside a frame are replayed by the
    frame itself (`tapThrough` at the top skips iframes).
  - A toolbar click before `document_idle` injected the scripts a second time and the
    second `onMessage` listener undid the first toggle. `content.js` now guards with
    `window.webpenBound` and calls the new `Presenter.toggle()` instead of poking at
    `.presenter-bar` (which the shadow root hides anyway). `host_permissions` added so
    the on-demand injection also works without a fresh gesture.
- `Presenter` API grew: `toggle()`, `shown()`, `state()`, `onChange(fn)`, `inFrame`,
  `frameState(s)`. Existing calls unchanged.
- Ported to the lessons site by hand (`Z_INDEX` 5900 there, nothing sits between 5900
  and 5950 so one host replaces the old canvas/dock pair) and logged in its tracker. The
  lessons copy was checked with the same pen harness on lesson 3 served locally; not
  deployed.
- Still needs the iPad: pencil over a YouTube or Desmos embed in Safari (the bookmarklet
  cannot inject into cross-origin frames, so only same-document content draws there),
  and a sanity pass that the shadow-root bar still follows pinch zoom.

### 2026-10-20 - Project created from the lessons overlay

- `src/presenter.js` copied from the lessons site as of its 2026-10-20 state (visual
  viewport geometry, pen colors, thick toggle, undo, erase, laser tap-through, fading
  laser notes). Only change: z-index raised to 2147483000 / 2147483001 so the overlay
  sits above any site's own layers (the lessons copy keeps 5900 so its login gate stays
  on top).
- `bookmarklet/index.html`: copy-the-code page with iPad steps; the bookmark loads the
  script from the lessons site for now (`SCRIPT_URL`).
- `extension/`: Manifest V3 skeleton. `presenter.js` + `content.js` as content scripts
  on all URLs, `background.js` toggles the bar from the toolbar button and injects the
  scripts on demand for tabs opened before the install. No icons yet.
- `scripts/sync.py` copies `src/presenter.js` into `extension/`.
- Nothing tested yet in this repo (the overlay itself was tested inside the lessons).

## Next Steps

- [ ] Serve `bookmarklet/index.html` locally, build the bookmark in desktop Chrome and
      use it on two sites; write exact iPad Safari steps. Note which sites refuse it
      (Content Security Policy).
- [ ] Give this project its own Netlify site hosting `presenter.js` at `/presenter.js`
      and the bookmarklet page at `/`, then point `SCRIPT_URL` at it so the lessons site
      and this project can evolve separately. Deploy stays a manual command.
- [ ] Decide the single source of truth for `presenter.js`: either the lessons site
      copies from here on each release, or this repo pulls from the lessons site.
- [ ] Extension polish: icons (16/32/48/128), a popup with the same buttons as the bar
      for mouse users, keyboard shortcut to toggle, store listing text.
- [ ] iPad checks listed under the 2026-10-20 entry above.
- [ ] Later: Safari Web Extension wrapper (Xcode) so the iPad gets a real toggle
      without a bookmark.

## Conventions

- No emojis. Plain hyphens. Commits carry no tool attribution.
- Log every session here in the same commit.
- Test with a local static server and synthetic "pen" pointer events plus canvas pixel
  reads; anything about touch, pinch zoom or Safari needs the real iPad.
