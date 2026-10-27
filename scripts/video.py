"""Build docs/linkedin.mp4 (the 26 s portrait promo, 1080x1350, no sound) and
docs/linkedin.gif (the same clip, small enough for the README) with ffmpeg.

Inputs: video/iphone.mp4, a screen recording from the iPhone (kept out of git), and
docs/demo.gif from `node tests/demo.js && python scripts/gif.py`. The phone section
cuts two moments out of the recording, PHONE_CUTS, so a new recording needs new times
and maybe new crop tops (the crop drops the status bar and the Safari address bar).
Fonts are the Windows Segoe UI files."""
import pathlib, subprocess, sys, tempfile

root = pathlib.Path(__file__).resolve().parent.parent
phone = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / "video" / "iphone.mp4"
demo = root / "docs" / "demo.gif"
out = root / "docs" / "linkedin.mp4"
gif = root / "docs" / "linkedin.gif"

BOLD = "C\\:/Windows/Fonts/segoeuib.ttf"
REG = "C\\:/Windows/Fonts/segoeui.ttf"
BG = "0x0f172a"
W, H, FPS = 1080, 1350, 30
PHONE_CUTS = [(3.5, 11.0, 145), (30.0, 35.3, 285)]  # start s, end s, crop top px
PHONE_SPEED = 1.25
DEMO_SPEED = 1.75
GIF_WIDTH = 432
GIF_FPS = 12

if not phone.exists():
    sys.exit(f"missing {phone}: put the iPhone screen recording there or pass its path")


def txt(t, size, y, color="white", font=BOLD, x="(w-text_w)/2"):
    return f"drawtext=fontfile='{font}':text='{t}':fontsize={size}:fontcolor={color}:x={x}:y={y}"


def fades(d):
    return f"fade=t=in:st=0:d=0.3,fade=t=out:st={d - 0.3:.2f}:d=0.3"


def bg(d):
    return ["-f", "lavfi", "-i", f"color=c={BG}:s={W}x{H}:d={d}:r={FPS}"]


def ffmpeg(*args, cwd=None):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True, cwd=cwd)


with tempfile.TemporaryDirectory() as tmp:
    b = pathlib.Path(tmp)

    def section(name, inputs, graph, dur):
        # The graph goes through a file: drawtext quoting does not survive the Windows command line.
        (b / f"{name}.txt").write_text(graph, encoding="utf-8")
        ffmpeg(*inputs, "-filter_complex_script", str(b / f"{name}.txt"), "-map", "[out]",
               "-t", str(dur), "-r", str(FPS), "-c:v", "libx264", "-crf", "20", "-preset", "medium",
               "-pix_fmt", "yuv420p", "-an", str(b / f"{name}.mp4"))

    d = 2.6
    section("hook", bg(d), "[0:v]" + ",".join([
        txt("Your pen is", 112, 440), txt("invisible", 112, 580, "0xef4444"),
        txt("on screen share.", 112, 720), fades(d)]) + "[out]", d)

    d = sum(end - start for start, end, _ in PHONE_CUTS) / PHONE_SPEED
    cuts = "".join(f"[1:v]trim={start}:{end},setpts=(PTS-STARTPTS)/{PHONE_SPEED},"
                   f"crop=1080:1985:0:{top}[c{i}];" for i, (start, end, top) in enumerate(PHONE_CUTS))
    joined = "".join(f"[c{i}]" for i in range(len(PHONE_CUTS)))
    section("phone", bg(d) + ["-i", str(phone)],
            cuts + f"{joined}concat=n={len(PHONE_CUTS)}:v=1:a=0,scale=-2:1190,"
            "pad=iw+8:ih+8:4:4:color=0x334155[p];[0:v][p]overlay=46:76,"
            "drawbox=x=740:y=420:w=90:h=10:color=0xef4444:t=fill,"
            + ",".join([txt("iPhone", 96, 460, x="740"), txt("and iPad", 60, 580, x="740"),
                        txt("Finger or", 44, 700, "0xcbd5e1", REG, "740"),
                        txt("Apple Pencil", 44, 756, "0xcbd5e1", REG, "740"), fades(d)]) + "[out]", d)

    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                            "-of", "csv=p=0", str(demo)], capture_output=True, text=True, check=True)
    d = float(probe.stdout) / DEMO_SPEED
    section("desk", bg(d) + ["-i", str(demo)],
            f"[1:v]setpts=PTS/{DEMO_SPEED},fps={FPS},scale=1080:675[v];[0:v][v]overlay=0:360,"
            + ",".join([txt("Mac and Windows", 84, 130),
                        txt("Safari, Chrome, Edge", 50, 245, "0xcbd5e1", REG),
                        txt("On any web page you teach from", 46, 1110, "0xcbd5e1", REG),
                        fades(d)]) + "[out]", d)

    d = 3.4
    section("outro", bg(d), "[0:v]" + ",".join([
        txt("WebPenPresenter", 104, 470),
        txt("Free. Open source. Private by design.", 46, 620, "0xcbd5e1", REG),
        txt("webpen-presenter.netlify.app", 54, 760, "0xf87171"), fades(d)]) + "[out]", d)

    (b / "list.txt").write_text("".join(f"file '{n}.mp4'\n" for n in ["hook", "phone", "desk", "outro"]),
                                encoding="utf-8")
    ffmpeg("-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "-movflags", "+faststart",
           str(out), cwd=b)

ffmpeg("-i", str(out), "-vf",
       f"fps={GIF_FPS},scale={GIF_WIDTH}:-1:flags=lanczos,split[a][b];"
       "[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle",
       "-loop", "0", str(gif))
for f in (out, gif):
    print(f.relative_to(root), f.stat().st_size // 1024, "KB")
