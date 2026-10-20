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

- [ ] Load `extension/` unpacked in Chrome, open three different sites (a news site,
      a Google Doc, a page with its own fixed header) and check: button shows the bar,
      laser and pen draw over the page, scrolling keeps marks in place, button hides it.
- [ ] Try the bookmarklet page on the iPad: build the bookmark, use it on two sites,
      note which sites refuse it (Content Security Policy).
- [ ] Give this project its own Netlify site (or GitHub Pages) hosting `presenter.js`
      and the bookmarklet page, then point `SCRIPT_URL` at it so the lessons site and
      this project can evolve separately.
- [ ] Decide the single source of truth for `presenter.js`: either the lessons site
      copies from here on each release, or this repo pulls from the lessons site.
- [ ] Extension polish: icons (16/32/48/128), a popup with the same buttons as the bar
      for mouse users, keyboard shortcut to toggle, store listing text.
- [ ] Later: Safari Web Extension wrapper (Xcode) so the iPad gets a real toggle
      without a bookmark.

## Conventions

- No emojis. Plain hyphens. Commits carry no tool attribution.
- Log every session here in the same commit.
