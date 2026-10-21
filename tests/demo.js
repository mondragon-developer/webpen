const L = require("./lib");
const T = require("./tests");
const fs = require("fs");
const path = require("path");

// Records the README demo: the extension on a Wikipedia article, every tool in turn,
// one PNG frame per step into FRAMES (default: a demo-frames folder next to this file).
// scripts/gif.py turns the folder into docs/demo.gif.
const FRAMES = process.env.FRAMES || path.join(__dirname, "demo-frames");
fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });
let n = 0;
const frames = [];

async function snap(page, hold = 1) {
  const file = path.join(FRAMES, String(n++).padStart(4, "0") + ".png");
  await page.screenshot({ path: file, type: "png" });
  frames.push({ file: path.basename(file), hold });
}

// One stroke drawn point by point, a frame every `every` points, so the line grows on
// screen instead of appearing at once.
async function fire(page, name, p, buttons) {
  await page.evaluate(({ name, p, buttons }) => {
    const e = new PointerEvent(name, { bubbles: true, cancelable: true, composed: true, pointerType: "pen", pointerId: 7, isPrimary: true, clientX: p.x, clientY: p.y, buttons, button: name === "pointermove" ? -1 : 0, pressure: buttons ? 0.5 : 0, view: window });
    (document.elementFromPoint(p.x, p.y) || document.body).dispatchEvent(e);
  }, { name, p, buttons });
}

async function stroke(page, pts, o = {}) {
  const every = o.every || 2;
  await fire(page, "pointerdown", pts[0], 1);
  for (let i = 1; i < pts.length; i++) {
    await fire(page, "pointermove", pts[i], 1);
    if (i % every === 0) await snap(page);
  }
  await fire(page, "pointerup", pts[pts.length - 1], 0);
  await snap(page);
}

async function hover(page, pts) {
  for (const p of pts) {
    await L.pen(page, [p], { hover: true });
    await snap(page);
  }
}

function line(a, b, steps) {
  const out = [];
  for (let i = 0; i <= steps; i++) out.push({ x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps });
  return out;
}

function wave(x0, y0, w, amp, steps) {
  const out = [];
  for (let i = 0; i <= steps; i++) out.push({ x: x0 + w * i / steps, y: y0 + amp * Math.sin(i / steps * Math.PI * 3) });
  return out;
}

(async () => {
  const { ctx, sw } = await L.launch();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("https://en.wikipedia.org/wiki/Normal_distribution", { waitUntil: "domcontentloaded" });
  await L.settle(page, 3000);
  await page.evaluate(() => window.scrollTo(0, 520)); await L.settle(page, 400);
  await snap(page, 8);

  await L.toggle(sw, page); await L.settle(page, 300);
  await page.bringToFront();
  await snap(page, 8);

  // Laser: hover across a paragraph, then write "12" as a note and let it fade.
  await hover(page, line({ x: 300, y: 250 }, { x: 640, y: 255 }, 10));
  await stroke(page, line({ x: 420, y: 430 }, { x: 424, y: 500 }, 6));
  await stroke(page, [{ x: 452, y: 445 }, { x: 465, y: 436 }, { x: 480, y: 440 }, { x: 482, y: 460 }, { x: 465, y: 480 }, { x: 450, y: 500 }, { x: 470, y: 500 }, { x: 490, y: 500 }], { every: 1 });
  for (let i = 0; i < 14; i++) { await L.settle(page, 200); await snap(page); }

  // Mark: a sentence.
  await T.clickBar(page, "Mark"); await snap(page, 3);
  await stroke(page, line({ x: 300, y: 215 }, { x: 660, y: 216 }, 14));
  await snap(page, 4);

  // Pen: a circle, then blue and thick.
  await T.clickBar(page, "Pen"); await snap(page, 3);
  const circ = []; for (let a = -0.3; a <= 6.4; a += 0.35) circ.push({ x: 980 + 70 * Math.cos(a), y: 330 + 45 * Math.sin(a) });
  await stroke(page, circ);
  await T.clickBar(page, "Red"); await snap(page, 2);
  await T.clickBar(page, "Thick"); await snap(page, 3);
  await stroke(page, wave(700, 600, 220, 30, 16));
  await snap(page, 5);

  // Erase part of the circle, then undo it.
  await T.clickBar(page, "Erase"); await snap(page, 3);
  await stroke(page, line({ x: 1040, y: 300 }, { x: 1060, y: 370 }, 6));
  await snap(page, 5);
  await T.clickBar(page, "Undo"); await snap(page, 8);

  // Scroll: marks stay on the text.
  for (const y of [560, 600, 640, 680, 640, 600, 560, 520]) {
    await page.evaluate((y) => window.scrollTo(0, y), y); await L.settle(page, 120); await snap(page, 2);
  }
  await snap(page, 5);

  // Clear and hide.
  await T.clickBar(page, "Clear"); await snap(page, 8);
  await T.clickBar(page, "Hide"); await snap(page, 10);

  fs.writeFileSync(path.join(FRAMES, "frames.json"), JSON.stringify(frames));
  console.log(frames.length + " frames in " + FRAMES);
  await ctx.close();
})().catch((e) => { console.error(e); process.exit(1); });
