const { chromium } = require("playwright");
const path = require("path");
const L = require("./lib");
const T = require("./tests");

// Reads SCRIPT_URL and the bookmark code from the served bookmarklet page, exactly as a
// user would copy it, then runs the code on each site. A local copy of presenter.js
// stands in for the hosted one unless HOSTED=1.
(async () => {
  const browser = await chromium.launch({ channel: "chromium", headless: true, });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:8768/bookmarklet/index.html");
  let code = await page.evaluate(() => document.getElementById("code").value);
  const hosted = await page.evaluate(() => window.SCRIPT_URL);
  console.log("bookmark code starts:", code.slice(0, 60), "| hosted url:", hosted);
  T.log("bookmarklet page: code starts with javascript: and calls Presenter.show", code.startsWith("javascript:") && code.includes("Presenter.show()"));
  T.log("bookmarklet page: drag link carries the same code", (await page.evaluate(() => document.getElementById("drag").getAttribute("href"))) === code);
  // An https page refuses an http script (mixed content), so the local copy is only
  // usable with the insecure-content flag; HOSTED=1 uses the real hosted file instead.
  if (!process.env.HOSTED) await page.route(/presenter\.js(\?|$)/, (route) => route.fulfill({ path: path.join(__dirname, "..", "src", "presenter.js"), contentType: "application/javascript" }));
  const js = code.replace(/^javascript:/, "");

  const sites = [
    ["wikipedia", "https://en.wikipedia.org/wiki/Standard_deviation"],
    ["bbc", "https://www.bbc.com/news"],
    ["github", "https://github.com/"],
  ];
  for (const [name, url] of sites) {
    const errors = [];
    const onErr = (e) => errors.push(e.message.slice(0, 100));
    page.on("pageerror", onErr);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await L.settle(page, 2500);
      await page.evaluate(js);
      await page.waitForFunction(() => !!window.Presenter, null, { timeout: 8000 }).catch(() => {});
      const has = await page.evaluate(() => !!window.Presenter);
      if (!has) {
        const csp = await page.evaluate(() => { const m = document.querySelector("meta[http-equiv='Content-Security-Policy']"); return m ? m.content.slice(0, 80) : "(header)"; });
        T.log(name + ": bookmarklet blocked (script never loaded)", false, { csp, errors });
        continue;
      }
      await L.settle(page, 300);
      await T.drawTests(page, name, { x: 500, y: 400 });
      await page.evaluate(js);
      await L.settle(page, 200);
      T.log(name + ": second tap keeps the bar shown without reloading the script", await page.evaluate(() => Presenter.shown() && document.querySelectorAll("script[src*='presenter.js']").length === 1));
    } catch (e) { T.log(name + ": errored", false, e.message.slice(0, 160)); }
    page.off("pageerror", onErr);
  }
  await browser.close();
  process.exit(T.summary() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
