# Test rig

Playwright drives the bundled Chromium with the extension loaded, dispatches synthetic
PointerEvents of pointerType "pen" and "mouse", and reads pixels back from the overlay
canvas. Branded Chrome 137+ ignores `--load-extension`, so the rig must use Playwright's
own Chromium (`npx playwright install chromium` once).

Setup, once:

    cd tests
    npm install
    npx playwright install chromium

Static servers the scripts expect (start each in its own terminal):

    python -m http.server 8765 --bind 127.0.0.1 --directory tests/pages
    python -m http.server 8768 --bind 127.0.0.1                      # repo root, for the bookmarklet page

Scripts, run from `tests/`:

- `node suite.js`: the extension on the local pages (sticky header, hostile button CSS,
  page pointer listeners, transformed body, same-origin and YouTube iframes, early
  second injection) and on Wikipedia, MDN, Excalidraw, GeoGebra, BBC.
- `node popup.js`: the popup opened as a page aimed at the test tab, every button, the
  toggle command, the note on a browser page.
- `node bookmarklet.js`: the bookmark code from the served page on BBC, Wikipedia and
  GitHub, with `src/presenter.js` answered for the hosted URL; `HOSTED=1` uses the real
  hosted file.
- `node shots.js`: the two store screenshots into `store/`.

Each run creates a `profile-*` folder next to the scripts and removes it on close; a
crashed run may leave one behind, safe to delete. The page under test must stay in
front: a hidden tab gets no animation frames and the overlay never repaints.
- `node demo.js`: records the README demo on the Wikipedia normal distribution article,
  one PNG per step into `tests/demo-frames/` (ignored by git); `python scripts/gif.py`
  then assembles `docs/demo.gif`.
