# WebPen Presenter

Laser pointer, highlighter, pen, eraser, undo and fading quick notes drawn over any
web page, so a screen share (Zoom, Teams, a projector) shows where the instructor is
pointing and what they are writing. Built for an iPad with an Apple Pencil; works with
a mouse too.

The whole overlay is one file, `src/presenter.js`. It injects its own styles, needs no
library, and exposes `window.Presenter = { enable, show, hide, clear, undo, viewport }`.
It started life inside the Statistics Lessons site
(`Statistics-Activities-Netlify/public/shared/presenter.js`), which still carries its
own copy.

Two ways to get it onto any page:

- `bookmarklet/index.html`: a page that hands out a bookmark whose address loads
  `presenter.js` from a hosted URL and shows the bar. Works in iPad Safari and every
  desktop browser; tap it again after a reload.
- `extension/`: a Chrome / Edge extension (Manifest V3). The content script loads
  `presenter.js` on every page; the toolbar button shows or hides the bar. Load it
  unpacked from `chrome://extensions` (Developer mode, Load unpacked, pick the folder).

After editing `src/presenter.js`, run `python scripts/sync.py` so `extension/presenter.js`
matches. The bookmarklet loads whatever `SCRIPT_URL` in `bookmarklet/index.html` points
to; today that is the lessons site, so the lessons copy must be updated and deployed for
the bookmarklet to change.

Tools on the bar: Laser (red dot; strokes stay while you keep writing and fade 2 s after
the last lift; a quick pencil tap presses the control under it), Mark (highlighter),
Pen, Red / Blue, Thick, Erase, Undo, Clear, Finger (fingers draw too), Hide. Mark, Pen
and Erase capture the pencil and let fingers work the page.
