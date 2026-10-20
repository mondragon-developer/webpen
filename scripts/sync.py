"""Copy src/presenter.js into the extension folder. Run after every change to
the source so the extension and the bookmarklet host ship the same file."""
import pathlib, shutil

root = pathlib.Path(__file__).resolve().parent.parent
shutil.copyfile(root / "src" / "presenter.js", root / "extension" / "presenter.js")
print("extension/presenter.js updated")
