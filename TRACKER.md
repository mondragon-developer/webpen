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

### 2026-10-26 - Embedded in StaTools

- statools.mdragonsolutions.com sends `script-src 'self'`, so the bookmark could not
  load the hosted file there. StaTools now serves its own copy; the bookmark finds
  `window.Presenter` and only calls `show()`. Details and checks are in that repo's
  local TRACKER; listed under Conventions as a downstream copy.
- Pushed (`b1f605b` there); Vercel deployed it from `main` on its own about 40 s
  later. Checked live on an iPhone 13 viewport: no overlay for a plain visitor,
  `/calculators/normal?present=1` shows the chip, the bar stays open after navigating
  to All Calculators, the voice button sits at 104 px above it, no CSP refusals or
  page errors, and the live `/presenter.js` matches `src/` byte for byte.
- State at the end of the day: this repo, the hosted file, the lessons site and
  StaTools all carry the same `presenter.js` and are deployed. Open items are in
  Next Steps (iPad checks, the store upload).

### 2026-10-26 - Hosted file and lessons site deployed

- `netlify deploy --prod` here twice (the final-check fixes, then the rename); the live
  `presenter.js` matches `src/` byte for byte and the setup page title reads
  WebPenPresenter.
- Lessons site: copy updated, checked locally with Playwright on lesson 1-2 (no overlay
  for a student, the chip within the poll once `Session.instructor` is set, z-index
  5900, a pen stroke paints, the bar survives a reload, `?present=1` opens the chip, no
  page errors), then its 6 pending commits pushed and `netlify deploy --prod` run there
  (the site is not linked to Git, so a push alone does not deploy). Live
  `/shared/presenter.js` matches `src/`.

### 2026-10-26 - Product name written as one word: WebPenPresenter

- Display name changed from "WebPen Presenter" (and the short "WebPen") to
  "WebPenPresenter" in the manifest name and toolbar title, the popup, the setup and
  privacy pages, the store listing, the README, CLAUDE.md and the header of
  `src/presenter.js`. Identifiers stay as they were (`webpen-presenter` storage key,
  message tag and `data-webpen-presenter` marker, the Netlify and GitHub URLs), and
  older entries in this log keep the old spelling. Store zip rebuilt.

### 2026-10-26 - Final check fixes: pages can no longer switch the extension on

- A whole-repo final check found that the extension's copy took its state from the
  page's own sessionStorage and from `?present=1`, both written by the page, so any page
  could build the overlay already on, hide the bar with CSS and read the mouse and pen
  points its cross-origin embeds forwarded. `src/presenter.js` now tells a page's own
  copy (script tag or bookmark, which have a `currentScript`) from the extension's
  (none): only the former reads or writes sessionStorage or honors `?present=1`. The
  extension keeps the top frame's last state in `chrome.storage.session`, keyed by tab
  and origin (the scope sessionStorage had), cleared on tab close; `content.js` asks for
  it before its first report and restores it. New permission: `storage`, justified in
  `store/listing.md`; README, privacy page and listing text updated.
- Two copies on one page (a site that embeds the file, plus the extension) each built
  an overlay, so one laser tap clicked twice. The first copy to build marks `<html>`
  with `data-webpen-presenter`; the other stays unbuilt, its `show`/`toggle`/`set` do
  nothing and its state says `yielded`, which the popup turns into a note.
- Points from a CSS-scaled iframe are mapped through the scale (bounding box against
  `offsetWidth`/`offsetHeight`) and clamped inside the visible box.
- The frame token is made only by the extension's copy; the comment now says it filters
  stray traffic and that clamping plus no remote taps is the boundary. sessionStorage
  key renamed `presenter` to `webpen-presenter`. The setup page's copy button opens the
  code box and reports when the fallback copy fails. `sync.py` rebuilds `site/` from
  scratch. The rig uses a temporary profile Playwright deletes; `suite.js` reuses
  `tests.js` instead of a copy of it; `shots.js` and `tests/README.md` say screenshot-2
  is pasted together by hand; `tests/package-lock.json` committed.
- New suite cases: settings back after a reload, a fresh tab whose page seeds the
  storage keys and opens `?present=1#present` (no host, no frame messages), a page that
  embeds its own copy (`tests/pages/embed.html`: one host at z 5900, the extension
  yields, one tap is one click), a half-scale iframe. `node suite.js` 78 pass, 0 fail;
  `node popup.js` 12 pass, 1 fail (the shortcut check, as before); `node bookmarklet.js`
  BBC passes, Wikipedia and GitHub blocked by CSP as before. The setup page's copy
  button checked with and without the clipboard API. Store zip rebuilt with
  `scripts/pack.py`.

### 2026-10-21 - README rewritten around a recorded demo

- `tests/demo.js` drives the extension on the Wikipedia normal distribution article
  and saves a PNG per step (laser hover and a "12" note that fades, a highlight, a red
  circle, a thick blue wave, an erase and its undo, a scroll that shows marks anchored,
  Clear, Hide), 90 frames with per-frame hold counts in `frames.json`. `scripts/gif.py`
  scales them to 960 px, quantizes to one 128-color palette and writes `docs/demo.gif`
  (909 KB). Both are documented in `tests/README.md` and the README itself.
- `README.md` rewritten for a reader deciding whether to use it: the demo first, who it
  is for, one line per tool, a table of where it works (iPad bookmark against the
  extension, input, sites, embeds), a "Safe by design" section stating what it does not
  do and the frame hardening in plain words, how to get it, a short developer section
  with the embed snippet and the scripts, author and license.

### 2026-10-21 - Overlay made independent of the lessons site

- Decided: WebPen is its own product and this repo is the only source of
  `presenter.js`. The lessons site (see Conventions) now embeds the file unchanged.
- `src/presenter.js`: the `window.Session` hook and its one-second poll are gone; the
  header comment, the Finger tooltip and the tap-through note no longer talk about
  lessons. `Z_INDEX` comes from a `data-z-index` attribute on the embedding script tag
  (`zIndexFromTag()`, default 2147483000; a content script has no currentScript and
  always gets the default). Activation is now only `?present=1`/`#present`,
  `Presenter.show()` or `Presenter.enable()`.
- `README.md`, `CLAUDE.md`, `store/listing.md`, `tests/README.md` and
  `tests/bookmarklet.js` (the `LESSON=1` option) no longer mention the lessons site.
- Lessons repo: `public/shared/presenter.js` is now byte-identical to `src/`; the
  Session poll moved to a new `public/shared/presenter-instructor.js`, and the 12 lesson
  pages load `presenter.js` with `data-z-index="5900"` followed by the instructor
  script (CRLF kept). Checked with Playwright on lesson 3 served locally: the host gets
  z-index 5900, and setting `Session.instructor` opens the chip within two seconds, no
  page errors. Committed there, not pushed, not deployed.
- Extension suite re-run after the change: 73 pass, 0 fail. Hosted file redeployed
  (`netlify deploy --prod`) and the store zip rebuilt with `scripts/pack.py`.
- Checked whether "WebPen" is a known brand: three web searches (trademark, Chrome
  extensions, stylus products) found no product, company or registered mark by that
  name; a USPTO search at tmsearch.uspto.gov and a search of the Chrome Web Store itself
  are the two checks worth doing by hand before publishing.

### 2026-10-21 - Store package built and checked

- `scripts/pack.py` writes `webpen-presenter-0.2.0.zip` (ignored by git) with the
  extension files at the top level and forward slashes in the entry names; a first
  attempt with PowerShell's Compress-Archive stored `icons\icon128.png`, which the Web
  Store would not resolve. Checked: the zip's presenter.js is byte-identical to `src/`,
  the manifest carries `scripting` and `<all_urls>` only, icon 128x128, screenshots
  1280x800, summary 119 characters, privacy URL answers 200, and no `innerHTML`, `eval`,
  `fetch` or `http://` anywhere in the extension files.
- Decided: no subresource integrity for the bookmark; 2FA on Netlify and GitHub is the
  protection. Decided: this repo is the source of `presenter.js`, the lessons site
  receives a copy on each change.

### 2026-10-21 - Deployed; setup page rewritten for non-technical readers; author and MIT license

- `netlify deploy --prod` from `site/` (deploy 6ad8d99cd17160cf0bc8171d). Checked live
  with curl: the CSP, HSTS (Netlify adds `preload`), `X-Frame-Options: DENY` and
  nosniff headers are served on `/`; `/presenter.js` keeps max-age 300 and open CORS
  and is byte-identical to `src/`. `tests/bookmarklet.js` re-run with `HOSTED=1`
  against the live file: BBC passes every check, Wikipedia and GitHub blocked by CSP
  as before. The CSP did not break the page: the copy button, the drag link and the
  code textarea all come from `bookmarklet.js`.
- `bookmarklet/index.html` rewritten in plain language: what it is in one line, the
  iPad setup as three numbered steps (save the bookmark, copy the code with one
  button, paste it over the address), the code itself folded away under "Show the
  code", computer setup, a "Use it in class" section with one plain sentence per tool,
  and "If it does not work". Same ids and the same `bookmarklet.js`, so the harness
  and the generated code are unchanged.
- Marked as Jose Mondragon's work under the MIT License: `LICENSE` added, a section in
  `README.md`, a footer line on the setup and privacy pages, `"author"` in
  `manifest.json`, and a first line in the header comment of `src/presenter.js`
  (ported to the lessons copy as well, so the files still differ only in `Z_INDEX`).

### 2026-10-21 - Security review: frame messages hardened, permissions and listing aligned, site headers

- Review of the overlay, the extension, the bookmarklet page and the Netlify config. One
  finding mattered: the top frame accepted any `postMessage` tagged `webpen-presenter`
  from any iframe in the page, passed its coordinates through unclamped, and in Laser
  mode replayed the tap with `elementFromPoint().click()`. An ad or embed could click any
  element of the page around it while the bar was on, across origins. Same listener in
  the bookmarklet.
- `src/presenter.js`: the top frame makes a random token (`crypto.getRandomValues`) and
  ships it in `Presenter.state()`, so it reaches frames only over the carrier's own
  channel (`webpen-state`), which pages cannot read; a frame echoes it in every message
  and the top frame drops messages without it. The bookmarklet gives out no token, so it
  ignores every message (the page could still read it from `Presenter.state()` there,
  which only buys it what the next two rules allow). Each message is rebuilt field by
  field: type whitelisted, coordinates finite and clamped to the sender's box, at most
  `MAX_REMOTE_POINTS` (64) coalesced points, pointerType whitelisted. A remote event
  carries `remote: true` and never sets a tap, so a frame can at most draw inside its
  own area. Also: the `window.Session` poll (1 s for two hours) now runs only when the
  file is loaded by a page's script tag (`document.currentScript`), never as a content
  script, and `enable()` clears it; the bookmarklet's `Presenter.show()` does that.
- `extension/background.js`: `webpen-state` accepted from frame 0 only, `webpen-popup`
  only from an extension page (`sender.url` under `chrome.runtime.getURL("")`, which
  keeps the test's popup-as-tab working). Not reachable from pages before either, no
  `externally_connectable`; defense in depth.
- `manifest.json`: `activeTab` dropped, it was redundant next to `<all_urls>` host
  permission plus content scripts on every page, and `store/listing.md` justified it as
  if the overlay were injected on demand. The listing and `privacy.html` now say what
  ships: a content script on every page and frame, inert until the button or shortcut,
  needed so frames forward the pen; `scripting` re-injects tabs open before install.
  The privacy page also says that the bookmark's download shows Netlify the IP and,
  subject to the page's referrer policy, the page address.
- `netlify.toml`: HSTS, `X-Frame-Options: DENY`, and a CSP (`default-src 'none'`,
  scripts from self, inline styles allowed). For that the bookmarklet page's inline
  script moved to `bookmarklet/bookmarklet.js`; `sync.py` copies `.js` from
  `bookmarklet/` too and `tests/bookmarklet.js` reads `SCRIPT_URL` from the window.
- Tests: `tests/pages/frames.html` has a top-level button with a click counter and
  `suite.js` forges two messages from the same-origin iframe aimed above its box: without
  the token nothing paints and nothing is clicked; with the token (read through the
  service worker) the dot lands on the frame's corner, the button pixel stays clear and
  the counter stays 0. Suite: 73 pass, 0 fail. `popup.js`: 12 pass, the shortcut check
  fails as before (no key in the test profile). `bookmarklet.js`: BBC passes, Wikipedia
  and GitHub blocked by CSP as before.
- Ported to the lessons copy (`../Statistics-Activities-Netlify/public/shared/presenter.js`,
  Z_INDEX 5900) together with `Presenter.set`, so the two files differ only in that line.
  Logged in its tracker. The lessons load the file with a script tag, so their
  `Session` poll keeps working.
- Not deployed: `site/` needs `netlify deploy --prod` for the hosted file, the headers
  and the privacy page. Not decided: subresource integrity for the bookmark
  (`s.integrity`, CORS header already allows it) would pin the hosted file but force a
  new bookmark on every release. Keep 2FA on the Netlify and GitHub accounts; the
  bookmark is a standing trust in that host.

### 2026-10-20 - Netlify site created and deployed

- `netlify sites:create --name webpen-presenter` (team mondradev's team, project id
  cbb3ede7-5042-4ca1-812a-2af9f28fb568, admin at
  https://app.netlify.com/projects/webpen-presenter) and `netlify deploy --prod` from
  `site/`. Live: https://webpen-presenter.netlify.app/ (bookmarklet page),
  `/presenter.js` (byte-identical to `src/`, served with max-age 300 and open CORS),
  `/privacy.html`. The folder is linked (`.netlify/`, ignored by git), so later deploys
  are `python scripts/sync.py` then `netlify deploy --prod`.
- The bookmarklet harness re-run with `HOSTED=1` against the live file: BBC passes
  every check; Wikipedia and GitHub blocked by CSP as before.

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

- Test rig (`tests/`, see its README): Playwright drives the
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

- [ ] NEXT SESSION: shapes, outlined and filled (asked for on 2026-10-26, announced
      as "coming next" in the LinkedIn post). Starting points:
      - A Shape tool in the bar and the popup, with a kind (rectangle, ellipse) and a
        Fill toggle; color and Thick come from the pen settings. Square and circle by
        snapping when width and height are close, since a pen or finger has no Shift.
      - Drawn by dragging corner to corner with the pen, or any input in Finger mode;
        stored in page coordinates in `strokes` like a pen line, so scroll anchoring,
        Undo and Clear work unchanged. A fill is translucent so the page shows through.
      - Erase must hit shapes too: test against the outline, and the inside when filled;
        an erased shape goes whole rather than being split like a line.
      - Remote points from iframes go through the same path, already clamped.
      - Tests: suite cases reading pixels on the outline, inside (empty vs filled),
        after scroll, Undo and Erase; popup buttons. A wider bar may wrap to more rows,
        so recheck the StaTools button offsets (6.5rem) on a phone viewport.
      - Then sync, copy to the lessons site and StaTools, and update README, store
        listing and the setup page tool list.
- [ ] On the iPad, open a lesson as instructor on statistics-lessons.netlify.app and
      write with the Pencil (the lessons site went live on 2026-10-26 without it).
- [ ] Confirm the bookmark loads from the new host on the iPad.
- [ ] Load `extension/` unpacked in a real Chrome profile once: confirm the icon, the
      popup from the toolbar, and that Alt+Shift+P is bound at chrome://extensions/shortcuts.
      Then upload `webpen-presenter-0.2.0.zip` with the text in `store/listing.md`.
- [ ] Before publishing, search "WebPen" at tmsearch.uspto.gov and in the Chrome Web
      Store once by hand.
- [ ] iPad checks listed under the 2026-10-20 entry above.
- [ ] Later: Safari Web Extension wrapper (Xcode) so the iPad gets a real toggle
      without a bookmark.

## Conventions

- No emojis. Plain hyphens. Commits carry no tool attribution.
- Log every session here in the same commit.
- Test with a local static server and synthetic "pen" pointer events plus canvas pixel
  reads; anything about touch, pinch zoom or Safari needs the real iPad.
- Downstream copies of `src/presenter.js`, to receive the file unchanged after a
  change here, each with its own deploy: the Statistics Lessons site
  (`../Statistics-Activities-Netlify/public/shared/presenter.js`, loaded with
  `data-z-index="5900"` and followed by its own `presenter-instructor.js`) and StaTools
  (`../statools/public/presenter.js`, plain script tag in `index.html`, deployed on
  Vercel; its CSS keys off `data-webpen-presenter` on `<html>` to move
  its corner buttons, so keep that attribute). This list is the only place in the repo
  that names them.
