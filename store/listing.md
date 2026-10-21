# Chrome Web Store listing

Paste these into the developer dashboard. Fields in the order the dashboard asks for
them. Edge Add-ons takes the same text.

## Product details

Name: WebPen Presenter

Summary (132 characters max):

Laser pointer, highlighter, pen and fading quick notes over any web page, so a screen share shows what you point at and write.

Description:

WebPen Presenter puts a small tool bar on any web page and lets you draw over it while
you share your screen on Zoom, Teams or a projector. It is made for instructors who
teach from a browser: a textbook site, a calculator, a slide deck, a news article.

Tools:

- Laser: a red dot with a fading trail. Press and write, and the strokes stay together
  as a quick note that fades two seconds after you lift. A quick tap presses the button
  under the dot, so you can point and click with the same pen.
- Mark: a translucent yellow highlighter that stays until you clear it.
- Pen: a red or blue line that stays until you clear it; Thick doubles its width.
- Erase: rub out part of a line.
- Undo and Clear.
- Finger: lets a finger or mouse draw too, for tablets without a pen.

Marks are anchored to the page, so they stay put when you scroll. With a pen (Apple
Pencil, Surface Pen, Wacom), the pen draws and fingers keep scrolling and tapping the
page. With a mouse, the laser follows the pointer and clicks go through; use Finger
mode to draw with the mouse.

The toolbar button opens a popup with the same tools for mouse users; Alt+Shift+P shows
or hides the bar on the page. Embedded videos, calculators and other iframes can be
drawn over too.

The extension sends nothing anywhere and keeps no history. It only draws.

Category: Education

Language: English

## Privacy

Single purpose: draw a laser pointer, highlighter and pen over the current web page
for screen sharing.

Permission justifications:

- Host permission (all sites): the overlay is a content script on every page and in
  every frame. The instructor picks the site to draw over at presentation time, and
  embedded videos and calculators (iframes) have to forward the pen to the page around
  them, which only works when the script is already in each frame when it loads. The
  script builds nothing and reads nothing until the toolbar button or the shortcut is
  pressed; it never touches page content.
- scripting: inject the overlay into a tab that was open before the extension was
  installed, or whose scripts have not finished loading, when the button is pressed there.
- No remote code: the overlay script ships inside the package.

Data usage: the extension does not collect or transmit any user data. Tool settings
(laser or pen, color, thickness) are kept in the tab's session storage and vanish when
the tab closes.

Privacy policy URL: https://webpen-presenter.netlify.app/privacy.html

## Assets

- Icon 128x128: extension/icons/icon128.png
- Screenshots 1280x800 (at least one): store/screenshot-1.png (laser note over a
  page), store/screenshot-2.png (pen and highlighter with the popup open).
- Small promo tile 440x280: optional, skip for the first submission.

## Packaging

Run `python scripts/sync.py`, then `python scripts/pack.py`, which writes
`webpen-presenter-<version>.zip` in the repo root with the files at the top level
(manifest.json, background.js, content.js, presenter.js, popup.html, popup.js, icons/).
Upload that zip. Do not zip with PowerShell's Compress-Archive: its entry names carry
backslashes and the store then cannot find the icons.

## Updating a published version

1. Raise `"version"` in `extension/manifest.json` (the store refuses a zip with a
   version it already has).
2. `python scripts/sync.py`, then `python scripts/pack.py`.
3. In the developer dashboard open the item, go to Package, upload the new zip. The
   listing text and screenshots stay as they are.
4. Submit for review. Installed copies update on their own once it is approved.

The bookmark needs no store: `netlify deploy --prod` after `sync.py` and every bookmark
loads the new file on its next tap. The lessons site keeps its own copy and deploys
separately.
