# WebPen Presenter - working notes for assistants

- Read TRACKER.md first; it is the source of truth for state and next steps. Log every
  session there in the same commit as the work.
- `src/presenter.js` is the overlay and this repo is its only source. After editing it
  run `python scripts/sync.py` so `extension/presenter.js` matches. Keep the file
  self-contained and generic: no libraries, styles injected by the script, no hook for
  any particular site. A site that embeds it configures it through attributes on its
  script tag (`data-z-index`) and activates it with `?present=1` or `Presenter.show()`.
  Sites that carry a copy are listed under Conventions in TRACKER.md; they receive the
  file unchanged.
- Test in a real browser against a local static server (`python -m http.server`), with
  synthetic pointer events of pointerType "pen" and pixel reads from the canvas, plus a
  real check on the iPad for anything about touch, pinch zoom or Safari.
- Style: no emojis, plain hyphens, no obvious comments, strict equality, no AI
  attribution in commits or files.
