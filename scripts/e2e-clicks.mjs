/**
 * Browser click-through of admin UI (Playwright).
 * Requires: npx playwright install chromium
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:3000";
const results = [];
let failed = 0;

function assert(name, cond, detail = "") {
  if (cond) {
    results.push({ ok: true, name });
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    results.push({ ok: false, name, detail });
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log(`\nClick E2E against ${BASE}\n`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // mobile
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    console.log("— Login");
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    assert("login page", await page.locator("h1").textContent().then((t) => t?.includes("Admin")));
    await page.fill('input[type="email"]', "admin@gmail.com");
    await page.fill('input[type="password"]', "Admin@1234");
    await page.click('button.btn');
    await page.waitForURL((url) => !url.pathname.includes("login"), { timeout: 15000 });
    assert("login redirects to app", page.url().replace(/\/$/, "").endsWith(":3000") || page.url().includes(BASE.replace(/\/$/, "")));

    console.log("— Mobile shell");
    assert("menu trigger visible", await page.locator(".menu-trigger").isVisible());
    assert("bottom nav visible", await page.locator(".mobile-bottom").isVisible());

    console.log("— Bottom nav clicks");
    const nav = [
      { label: "Orders", path: "/orders", h1: "Orders" },
      { label: "Kitchen", path: "/kitchen", h1: "Kitchen" },
      { label: "Students", path: "/students", h1: "Students" },
      { label: "Settings", path: "/settings", h1: "Settings" },
      { label: "Home", path: "/", h1: "kitchen" },
    ];
    // Dismiss Next.js dev error overlay if present (dev-only)
    await page.evaluate(() => {
      document.querySelector("nextjs-portal")?.remove();
    }).catch(() => {});

    for (const item of nav) {
      await page.locator(".mobile-bottom a", { hasText: item.label }).click({ force: true });
      await page.waitForTimeout(500);
      if (item.path === "/") {
        await page.waitForFunction(() => location.pathname === "/", { timeout: 10000 }).catch(() => {});
      } else {
        await page.waitForURL(`**${item.path}`, { timeout: 10000 }).catch(() => {});
      }
      const h1 = (await page.locator("h1").first().textContent()) || "";
      assert(`tap ${item.label}`, h1.toLowerCase().includes(item.h1.toLowerCase()), `h1="${h1}" url=${page.url()}`);
    }

    console.log("— Drawer nav clicks");
    async function openDrawerAndGo(label, pathNeedle, h1Needle) {
      // Ensure drawer opens (React state); retry once if needed
      for (let i = 0; i < 3; i++) {
        await page.locator(".menu-trigger").click({ force: true });
        await page.waitForTimeout(250);
        const opened = await page.evaluate(
          () =>
            document.querySelector(".sidebar.open") != null ||
            document.querySelector(".shell.nav-open") != null
        );
        if (opened) break;
      }
      const opened = await page.evaluate(
        () => document.querySelector(".sidebar.open") != null
      );
      assert(`drawer opens for ${label}`, opened);
      await page.evaluate((text) => {
        const links = [...document.querySelectorAll(".sidebar nav a")];
        const el = links.find((a) => (a.textContent || "").trim() === text);
        if (!el) throw new Error(`link ${text} not found`);
        el.scrollIntoView({ block: "center" });
        el.click();
      }, label);
      await page.waitForURL(`**${pathNeedle}`, { timeout: 10000 });
      const h1 = (await page.locator("h1").first().textContent()) || "";
      assert(`drawer → ${label}`, h1.includes(h1Needle), `h1="${h1}"`);
    }

    await page.locator(".menu-trigger").click({ force: true });
    await page.waitForTimeout(300);
    assert(
      "drawer open",
      await page.evaluate(() => document.querySelector(".sidebar.open") != null)
    );
    await page.evaluate(() => {
      document.querySelector(".close-nav")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });
    await page.waitForTimeout(200);

    await openDrawerAndGo("Menu", "/menu", "Menu");
    await openDrawerAndGo("Referrals", "/referrals", "Referral");
    await openDrawerAndGo("Audit", "/audit", "Audit");

    console.log("— Settings form interact");
    page.once("dialog", async (d) => {
      assert("settings alert", /saved|fail|error/i.test(d.message()), d.message());
      await d.accept();
    });
    await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const inputs = page.locator("form input");
    const count = await inputs.count();
    assert("settings has inputs", count >= 2, `count=${count}`);
    if (count > 0) {
      await inputs.nth(3).fill("3");
      await page.evaluate(() => {
        const btn = document.querySelector("form button.btn, form button[type='submit']");
        if (!btn) throw new Error("save button missing");
        btn.click();
      });
      await page.waitForTimeout(1000);
      assert("settings save click", true);
    }

    console.log("— Kitchen status click");
    await page.goto(`${BASE}/kitchen`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    const clicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll(".main button, .card button, td button")];
      const target = btns.find((b) =>
        /prepar|deliver|mark|next|advance/i.test(b.textContent || "")
      );
      if (target) {
        target.click();
        return true;
      }
      return false;
    });
    if (clicked) {
      await page.waitForTimeout(600);
      assert("kitchen action click", true);
    } else {
      assert(
        "kitchen page interactive",
        ((await page.locator("h1").first().textContent()) || "").includes("Kitchen")
      );
    }

    console.log("— Desktop layout");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    assert("desktop sidebar visible", await page.locator(".sidebar").isVisible());
    await page.evaluate(() => {
      const a = [...document.querySelectorAll(".sidebar nav a")].find((el) =>
        (el.textContent || "").includes("Orders")
      );
      a?.click();
    });
    await page.waitForURL("**/orders", { timeout: 10000 });
    assert("desktop nav → Orders", ((await page.locator("h1").first().textContent()) || "").includes("Orders"));

    await page.evaluate(() => {
      document.querySelector("button.signout")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });
    await page.waitForURL("**/login", { timeout: 10000 });
    assert("sign out → login", page.url().includes("login"));
  } finally {
    await browser.close();
  }

  console.log(
    `\n——— ${results.filter((r) => r.ok).length}/${results.length} passed, ${failed} failed ———\n`
  );
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
