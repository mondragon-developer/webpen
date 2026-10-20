"""Copy src/presenter.js into the extension folder and assemble the Netlify publish
folder (site/: presenter.js plus the bookmarklet pages). Run after every change to the
source so the extension and the hosted file ship the same bytes."""
import pathlib, shutil

root = pathlib.Path(__file__).resolve().parent.parent
src = root / "src" / "presenter.js"
shutil.copyfile(src, root / "extension" / "presenter.js")
print("extension/presenter.js updated")

site = root / "site"
site.mkdir(exist_ok=True)
shutil.copyfile(src, site / "presenter.js")
for page in (root / "bookmarklet").glob("*.html"):
    shutil.copyfile(page, site / page.name)
print("site/ assembled: " + ", ".join(sorted(p.name for p in site.iterdir())))
