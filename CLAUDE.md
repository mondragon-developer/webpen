# WebPen Presenter - working notes for assistants

- Read TRACKER.md first; it is the source of truth for state and next steps. Log every
  session there in the same commit as the work.
- `src/presenter.js` is the overlay. After editing it run `python scripts/sync.py` so
  `extension/presenter.js` matches. Keep the file self-contained: no libraries, styles
  injected by the script, nothing that depends on a host page.
- The same file lives in the Statistics Lessons site
  (`../Statistics-Activities-Netlify/public/shared/presenter.js`, z-index 5900 there).
  Until the source of truth is decided, port fixes both ways by hand and say so in both
  trackers.
- Test in a real browser against a local static server (`python -m http.server`), with
  synthetic pointer events of pointerType "pen" and pixel reads from the canvas, plus a
  real check on the iPad for anything about touch, pinch zoom or Safari.
- Style: no emojis, plain hyphens, no obvious comments, strict equality, no AI
  attribution in commits or files.
