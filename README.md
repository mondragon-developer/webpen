# WebPen Presenter

Laser pointer, highlighter, pen, eraser, undo and fading quick notes drawn over any
web page, so a screen share (Zoom, Teams, a projector) shows where the instructor is
pointing and what they are writing. Built for an iPad with an Apple Pencil; works with
a mouse too.

The whole overlay is one file, `src/presenter.js`. It injects its own styles into a
shadow root, needs no library, and exposes `window.Presenter = { enable, show, hide,
toggle, shown, clear, undo, viewport, state, onChange, inFrame, frameState }`. It
started life inside the Statistics Lessons site
(`Statistics-Activities-Netlify/public/shared/presenter.js`), which still carries its
own copy with a lower z-index.

Two ways to get it onto any page:

- `bookmarklet/index.html`: a page that hands out a bookmark whose address loads
  `presenter.js` from a hosted URL and shows the bar. Works in iPad Safari and every
  desktop browser; tap it again after a reload. Sites with a strict Content Security
  Policy (GitHub, Wikipedia, YouTube, Google Docs) ignore it.
- `extension/`: a Chrome / Edge extension (Manifest V3). The content script loads
  `presenter.js` in every frame of every page; the toolbar button shows or hides the
  bar. Load it unpacked from `chrome://extensions` (Developer mode, Load unpacked, pick
  the folder). Inside iframes the script draws nothing and forwards the pen to the top
  frame, so an embedded video or calculator can be drawn over too.

After editing `src/presenter.js`, run `python scripts/sync.py` so `extension/presenter.js`
matches. The bookmarklet loads whatever `SCRIPT_URL` in `bookmarklet/index.html` points
to.

Tools on the bar: Laser (red dot; strokes stay while you keep writing and fade 2 s after
the last lift; a quick pencil tap presses the control under it), Mark (highlighter),
Pen, Red / Blue, Thick, Erase, Undo, Clear, Finger (fingers draw too), Hide. Mark, Pen
and Erase capture the pencil and let fingers work the page.
