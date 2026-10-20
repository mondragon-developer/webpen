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

### 2026-10-20 - Extension polish: icons, popup, keyboard shortcut, store listing

- Icons 16/32/48/128 drawn by `scripts/icons.py` (Pillow): dark rounded tile, white
  stroke, red laser dot. Re-run the script to regenerate; the PNGs are committed.
- The toolbar button now opens `popup.html`, a copy of the bar for mouse users (show or
  hide, Laser, Mark, Pen, color, Thick, Erase, Undo, Clear, Finger). Every button sends
  one command through the service worker to the tab the popup was opened on and
  repaints from the state the page returns; a page that refuses scripts (chrome://, the
  Web Store) disables the buttons with a note. Because a popup swallows the toolbar
  click, the on-page toggle moved to a keyboard command, `toggle-bar`, suggested as
  Alt+Shift+P. `background.js` has one `command()` path for both (inject on demand,
  then send); `content.js` answers a single `webpen-cmd` message type (toggle, show,
  hide, undo, clear, set). `Presenter.set({mode, color, thick, allInput})` added to the
  overlay for this; synced to `extension/` (not yet ported to the lessons copy, it is
  additive and the lessons never call it).
- Tested with the harness: popup opened as a page aimed at the test tab, each button
  checked against the page's bar state and canvas pixels (12 checks pass), the toggle
  command message shows the bar, the browser-page note appears. The full five-site
  suite re-run after the protocol change: 61 pass, MDN still unreachable. The harness
  taught one thing worth keeping: a hidden tab gets no animation frames, so the page
  under test must stay in front or the overlay never repaints.
- `chrome.commands.getAll()` in the test profile reports `toggle-bar` without a key, so
  the Alt+Shift+P binding could not be confirmed there. Check once in a real profile at
  chrome://extensions/shortcuts after loading unpacked.
- `store/listing.md`: summary, description, category, single-purpose statement,
  permission justifications, data-usage answer, privacy policy URL (on the Netlify site),
  packaging steps. `store/screenshot-1.png` and `-2.png` (1280x800) captured by the
  harness on the Wikipedia normal distribution article with highlighter, pen, laser note,
  the bar, and the popup pasted in.

### 2026-10-20 - Hosting prepared: Netlify site folder, deploy left to run by hand

- `netlify.toml` publishes `site/`, no build command, short cache and open CORS on
  `/presenter.js`. `scripts/sync.py` now also assembles `site/` (presenter.js plus every
  page in `bookmarklet/`, so `/` is the bookmarklet page and `/privacy.html` the privacy
  note the store listing needs); `site/` and `.netlify/` are ignored by git.
- Site name chosen: `webpen-presenter` (`https://webpen-presenter.netlify.app` returned
  Netlify's 404, so it was free at the time of writing). `SCRIPT_URL` already points at
  it. Nothing has been created or deployed. To go live, from this folder:

      python scripts/sync.py
      netlify sites:create --name webpen-presenter
      netlify deploy --prod

  then open https://webpen-presenter.netlify.app/ and tap the bookmark on a BBC
  article. If the name is taken, pick another in `sites:create` and change `SCRIPT_URL`
  in `bookmarklet/index.html` to match before deploying.
- The lessons site keeps its own copy at `/shared/presenter.js`; the bookmark no longer
  depends on it.

### 2026-10-20 - Bookmarklet checked in desktop Chromium; exact iPad steps written

- Harness: plain Chromium (no extension) opens `bookmarklet/index.html` from a local
  static server, reads the code the page offers, runs it on each site and then runs the
  same pen checks as the extension suite (laser, red and blue pen, mouse ignored, erase,
  undo, scroll, clear, second tap keeps the bar without a second script tag). While the
  file is not hosted yet, the harness answers the hosted URL with the local
  `src/presenter.js` through a request route (an https page refuses an http script, so
  a plain local server cannot stand in).
- Results: BBC News and a lesson page from the lessons site served locally pass every
  check. Wikipedia and GitHub never load the script: both send a Content Security Policy
  with a `script-src` list. Headers checked with curl for the sites an instructor is
  likely to open: blocked are GitHub, Wikipedia, YouTube, Google Docs, GeoGebra; open
  are BBC, Desmos, Khan Academy, Canvas LMS, Excalidraw. Listed on the page.
- `bookmarklet/index.html` rewritten: numbered iPad Safari steps (Share, Add Bookmark,
  then Edit the bookmark and paste the code over its address; Favorites bar tip),
  computer steps (Ctrl+Shift+B, drag the button), use steps, limits (CSP sites, iframes
  under the bookmark), privacy line. `SCRIPT_URL` now points at the project's own host,
  `https://webpen-presenter.netlify.app/presenter.js`, which does not exist until the
  deploy in the next entry runs; until then the bookmark loads nothing.
- Needs the real iPad: the bookmark editing steps follow the current iPadOS Safari
  layout (book icon, Edit at the bottom of the bookmarks list) and should be walked once;
  tap the bookmark on a BBC article and confirm the bar appears and the pencil draws.

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

- [ ] Run the three deploy commands under the hosting entry above, then confirm the
      bookmark loads from the new host on the iPad.
- [ ] Decide the single source of truth for `presenter.js`: either the lessons site
      copies from here on each release, or this repo pulls from the lessons site.
- [ ] Load `extension/` unpacked in a real Chrome profile once: confirm the icon, the
      popup from the toolbar, and that Alt+Shift+P is bound at chrome://extensions/shortcuts.
      Then zip `extension/` and submit with `store/listing.md` (needs the privacy page
      deployed first).
- [ ] Port `Presenter.set` to the lessons copy on its next sync.
- [ ] iPad checks listed under the 2026-10-20 entry above.
- [ ] Later: Safari Web Extension wrapper (Xcode) so the iPad gets a real toggle
      without a bookmark.

## Conventions

- No emojis. Plain hyphens. Commits carry no tool attribution.
- Log every session here in the same commit.
- Test with a local static server and synthetic "pen" pointer events plus canvas pixel
  reads; anything about touch, pinch zoom or Safari needs the real iPad.
