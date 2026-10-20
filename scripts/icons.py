"""Draw the extension icons (16, 32, 48, 128 px) into extension/icons/: a dark rounded
tile, a white pen stroke and the red laser dot at its tip, rendered at 512 px and
downsampled so the small sizes stay smooth. Needs Pillow."""
import pathlib
from PIL import Image, ImageDraw

root = pathlib.Path(__file__).resolve().parent.parent
out = root / "extension" / "icons"
out.mkdir(exist_ok=True)

SIZE = 512
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), radius=110, fill=(15, 23, 42, 255))
# Pen stroke: a curve from top-left down to the dot, drawn as thick joined segments.
pts = [(120, 150), (170, 300), (240, 230), (300, 360), (352, 330)]
d.line(pts, fill=(226, 232, 240, 255), width=52, joint="curve")
for x, y in (pts[0], pts[-1]):
    d.ellipse((x - 26, y - 26, x + 26, y + 26), fill=(226, 232, 240, 255))
# Laser dot with a soft glow at the end of the stroke.
cx, cy = 372, 352
for r, a in ((120, 40), (96, 70), (72, 110)):
    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((cx - r, cy - r, cx + r, cy + r), fill=(239, 68, 68, a))
    img = Image.alpha_composite(img, glow)
d = ImageDraw.Draw(img)
d.ellipse((cx - 58, cy - 58, cx + 58, cy + 58), fill=(239, 68, 68, 255))
d.ellipse((cx - 30, cy - 34, cx - 2, cy - 6), fill=(255, 255, 255, 220))

for s in (16, 32, 48, 128):
    img.resize((s, s), Image.LANCZOS).save(out / f"icon{s}.png")
print("icons written to", out)
