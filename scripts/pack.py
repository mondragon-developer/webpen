"""Zip extension/ for the Chrome Web Store and Edge Add-ons. Written with zipfile rather
than PowerShell's Compress-Archive, which stores Windows backslashes in entry names and
makes the store fail to find icons/icon128.png."""
import json, pathlib, zipfile

root = pathlib.Path(__file__).resolve().parent.parent
ext = root / "extension"
version = json.loads((ext / "manifest.json").read_text(encoding="utf-8"))["version"]
out = root / ("webpen-presenter-" + version + ".zip")
files = ["manifest.json", "background.js", "content.js", "presenter.js", "popup.html", "popup.js"]
files += sorted("icons/" + p.name for p in (ext / "icons").glob("*.png"))
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for name in files:
        z.write(ext / name, name)
print(out.name + ": " + ", ".join(files))
