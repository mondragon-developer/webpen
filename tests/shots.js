const L = require("./lib");
const T = require("./tests");
const path = require("path");
const OUT = path.join(__dirname, "..", "store") + "/";

// Writes store/screenshot-1.png (1280x800: a page with highlighter, pen and a laser note)
// and store/popup.png. screenshot-2.png is screenshot-1 with popup.png pasted on by hand
// in an image editor; no script here builds it.
(async () => {
  const { ctx, sw } = await L.launch();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("https://en.wikipedia.org/wiki/Normal_distribution", { waitUntil: "domcontentloaded" });
  await L.settle(page, 3000);
  await page.evaluate(() => window.scrollTo(0, 520)); await L.settle(page, 300);
  await L.toggle(sw, page); await L.settle(page, 300);
  await page.bringToFront();
  await T.clickBar(page, "Mark");
  await L.pen(page, [{ x: 330, y: 215 }, { x: 420, y: 216 }, { x: 520, y: 215 }, { x: 640, y: 216 }]);
  await T.clickBar(page, "Pen");
  // a loose circle
  const circ = []; for (let a = 0; a <= 6.6; a += 0.3) circ.push({ x: 980 + 70 * Math.cos(a), y: 330 + 45 * Math.sin(a) });
  await L.pen(page, circ);
  await T.clickBar(page, "Red");
  await L.pen(page, [{ x: 700, y: 600 }, { x: 760, y: 560 }, { x: 820, y: 600 }, { x: 880, y: 560 }]);
  await T.clickBar(page, "Laser");
  // laser note: "1 2" written in two strokes
  await L.pen(page, [{ x: 420, y: 440 }, { x: 422, y: 500 }]);
  await L.pen(page, [{ x: 450, y: 445 }, { x: 475, y: 440 }, { x: 480, y: 465 }, { x: 450, y: 500 }, { x: 485, y: 500 }]);
  await L.settle(page, 80);
  await page.screenshot({ path: OUT + "screenshot-1.png" });
  console.log("screenshot-1 written");
  const extId = sw.url().split("/")[2];
  const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0].id);
  const popup = await ctx.newPage();
  await popup.setViewportSize({ width: 252, height: 230 });
  await popup.goto("chrome-extension://" + extId + "/popup.html?tabId=" + tabId); await L.settle(popup, 500);
  await popup.screenshot({ path: OUT + "popup.png" });
  console.log("popup written");
  await ctx.close();
})().catch((e) => { console.error(e); process.exit(1); });
