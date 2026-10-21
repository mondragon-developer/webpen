"""Assemble docs/demo.gif from the frames tests/demo.js recorded. Each frame carries a
hold count (how many base ticks it stays on screen) in frames.json; TICK is the base
duration in ms. Frames are scaled to WIDTH and quantized to one shared palette so the
file stays small enough for a README."""
import json, pathlib, sys
from PIL import Image

root = pathlib.Path(__file__).resolve().parent.parent
frames_dir = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / "tests" / "demo-frames"
out = root / "docs" / "demo.gif"
WIDTH = 960
TICK = 110

meta = json.loads((frames_dir / "frames.json").read_text(encoding="utf-8"))
images = []
durations = []
for f in meta:
    im = Image.open(frames_dir / f["file"]).convert("RGB")
    im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
    images.append(im)
    durations.append(TICK * f["hold"])

palette = images[0].quantize(colors=128, method=Image.Quantize.MEDIANCUT)
quantized = [im.quantize(colors=128, palette=palette, dither=Image.Dither.NONE) for im in images]
out.parent.mkdir(exist_ok=True)
quantized[0].save(out, save_all=True, append_images=quantized[1:], duration=durations, loop=0, optimize=True)
print(out.relative_to(root), out.stat().st_size // 1024, "KB,", len(images), "frames")
