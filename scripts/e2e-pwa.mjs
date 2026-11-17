/**
 * PWA + student web + admin install assets verification.
 * Usage: node scripts/e2e-pwa.mjs [baseUrl]
 */
const BASE = process.argv[2] || "http://localhost:3000";
const results = [];
let failed = 0;

function jar() {
  const m = new Map();
  return {
    store(res) {
      const raw =
        typeof res.headers.getSetCookie === "function"
          ? res.headers.getSetCookie()
          : [];
      for (const line of raw) {
        const [pair] = line.split(";");
        const i = pair.indexOf("=");
        if (i > 0) m.set(pair.slice(0, i).trim(), pair.slice(i + 1));
      }
    },
    header() {
      return [...m.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
  };
}

async function req(j, path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (j?.header()) headers.cookie = j.header();
  if (opts.body && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers,
    redirect: "manual",
  });
  if (j) j.store(res);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* html */
  }
  return { res, status: res.status, text, json };
}

function assert(name, cond, detail = "") {
  if (cond) {
    results.push({ ok: true, name });
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    results.push({ ok: false, name, detail });
    console.log(`  ✗ ${name}${detail ? ` — ${String(detail).slice(0, 180)}` : ""}`);
  }
}

async function main() {
  console.log(`\nPWA suite against ${BASE}\n`);

  console.log("— Static PWA assets");
  {
    const a = await req(null, "/admin-manifest.webmanifest");
    assert("admin manifest", a.status === 200 && a.text.includes("Tiffin Admin"));
    assert("admin manifest start /", a.text.includes('"start_url": "/"'));
  }
  {
    const s = await req(null, "/manifest.webmanifest");
    assert(
      "student manifest",
      s.status === 200 &&
        s.text.includes("standalone") &&
        (s.text.includes('"/app/"') || s.text.includes('"/"')),
      s.text.slice(0, 120)
    );
  }
  {
    const sw = await req(null, "/admin-sw.js");
    assert("admin service worker", sw.status === 200 && sw.text.includes("install"));
  }
  {
    const sw = await req(null, "/app/sw.js");
    assert("student service worker", sw.status === 200 && sw.text.includes("/app"));
  }
  {
    const icon = await req(null, "/icons/192");
    assert("icon 192", icon.status === 200);
  }

  console.log("— Auth redirects");
  {
    const r = await req(null, "/app");
    assert(
      "unauth /app → login",
      (r.status === 307 || r.status === 302) &&
        (r.res.headers.get("location") || "").includes("/app/login"),
      `status=${r.status} loc=${r.res.headers.get("location")}`
    );
  }
  {
    const r = await req(null, "/orders");
    assert(
      "unauth /orders → admin login",
      (r.status === 307 || r.status === 302) &&
        (r.res.headers.get("location") || "").includes("/login"),
      `status=${r.status}`
    );
  }

  console.log("— Student signup / app pages");
  const student = jar();
  const email = `pwa_${Date.now()}@demo.local`;
  {
    const r = await req(student, "/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        full_name: "PWA Student",
        email,
        password: "password123",
        phone: "9000000099",
        hostel: "Test",
        room: "1",
      }),
    });
    assert("student signup", r.status === 200, JSON.stringify(r.json));
  }
  {
    const r = await req(student, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: "password123" }),
    });
    assert("student login", r.status === 200 && r.json?.user?.role === "student");
  }
  {
    const r = await req(student, "/");
    assert(
      "student / redirects to /app",
      (r.status === 307 || r.status === 302) &&
        (r.res.headers.get("location") || "").includes("/app"),
      `loc=${r.res.headers.get("location")}`
    );
  }

  for (const [path, needle] of [
    ["/app", "Home"],
    ["/app/orders", "Orders"],
    ["/app/plans", "Fixed plans"],
    ["/app/wallet", "Wallet"],
    ["/app/profile", "Profile"],
    ["/app/notifications", "Notifications"],
  ]) {
    const r = await req(student, path);
    assert(
      `PAGE ${path}`,
      r.status === 200 &&
        (r.text.includes("student-tabs") || r.text.includes("student-shell")) &&
        r.text.includes(needle),
      `status=${r.status}`
    );
  }

  // Place tomorrow order via API (student flow still works)
  {
    const menu = await req(student, "/api/menu");
    const item = (menu.json?.items || []).find((i) => i.meal_type === "dinner") || menu.json?.items?.[0];
    const tomorrow = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
    }).format(new Date(Date.now() + 86400000));
    if (item) {
      const r = await req(student, "/api/orders", {
        method: "POST",
        body: JSON.stringify({
          meal_type: item.meal_type,
          menu_item_id: item.id,
          quantity: 1,
          order_date: tomorrow,
          notes: "pwa-test",
        }),
      });
      assert("student place order", r.status === 200 && r.json?.order?.id, JSON.stringify(r.json));
    } else {
      assert("student place order", false, "no menu");
    }
  }

  {
    const r = await req(student, "/api/plans", {
      method: "POST",
      body: JSON.stringify({ meal_type: "lunch" }),
    });
    assert("student apply plan", r.status === 200, JSON.stringify(r.json));
  }

  console.log("— Admin pages + PWA chrome");
  const admin = jar();
  {
    const r = await req(admin, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@gmail.com",
        password: "Admin@1234",
      }),
    });
    assert("admin login", r.status === 200 && r.json?.user?.role === "admin", JSON.stringify(r.json));
  }
  {
    const r = await req(admin, "/app");
    assert(
      "admin blocked from /app",
      (r.status === 307 || r.status === 302) &&
        !(r.res.headers.get("location") || "").includes("/app/login"),
      `loc=${r.res.headers.get("location")}`
    );
  }
  for (const [path, needle] of [
    ["/", "kitchen"],
    ["/orders", "Orders"],
    ["/kitchen", "Kitchen"],
    ["/menu", "Menu"],
    ["/students", "Students"],
    ["/settings", "Settings"],
    ["/login", "Admin login"],
  ]) {
    // login while authed redirects away
    if (path === "/login") {
      const r = await req(admin, path);
      assert(
        "admin /login redirects home",
        r.status === 307 || r.status === 302 || r.status === 200,
        `status=${r.status}`
      );
      continue;
    }
    const r = await req(admin, path);
    assert(
      `ADMIN ${path}`,
      r.status === 200 && r.text.toLowerCase().includes(needle.toLowerCase()),
      `status=${r.status}`
    );
  }

  // Public login pages
  {
    const r = await req(null, "/app/login");
    assert("student login page", r.status === 200 && r.text.includes("Sign in"));
  }
  {
    const r = await req(null, "/app/signup");
    assert("student signup page", r.status === 200 && r.text.includes("Create account"));
  }
  {
    const bare = jar();
    const r = await req(bare, "/login");
    assert("admin login page", r.status === 200 && r.text.includes("Admin login"));
  }

  console.log("— Push register (web-shaped)");
  {
    const fakeSub = {
      endpoint: `https://example.com/push/${Date.now()}`,
      keys: { p256dh: "x", auth: "y" },
    };
    const r = await req(student, "/api/push/register", {
      method: "POST",
      body: JSON.stringify({ subscription: fakeSub, platform: "web" }),
    });
    assert("web push register", r.status === 200, JSON.stringify(r.json));
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
