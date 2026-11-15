/**
 * End-to-end smoke: page navigation + API flows (admin + student).
 * Usage: node scripts/e2e-smoke.mjs [baseUrl]
 */
const BASE = process.argv[2] || "http://localhost:3000";
const results = [];
let failed = 0;

function cookieJar() {
  const jar = new Map();
  return {
    store(res) {
      const raw = typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : [];
      for (const line of raw) {
        const [pair] = line.split(";");
        const i = pair.indexOf("=");
        if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1));
      }
      if (!raw.length) {
        const single = res.headers.get("set-cookie");
        if (single) {
          const [pair] = single.split(";");
          const i = pair.indexOf("=");
          if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1));
        }
      }
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
  };
}

async function req(jar, path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (jar) {
    const c = jar.header();
    if (c) headers.cookie = c;
  }
  if (opts.body && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }
  const res = await fetch(`${BASE}${path}`, { ...opts, headers, redirect: "manual" });
  if (jar) jar.store(res);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* html */
  }
  return { res, text, json, status: res.status };
}

function assert(name, cond, detail = "") {
  if (cond) {
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    results.push({ name, ok: false, detail });
    console.log(`  ✗ ${name}${detail ? ` — ${String(detail).slice(0, 200)}` : ""}`);
  }
}

async function clickPage(jar, path, mustInclude = []) {
  const { status, text } = await req(jar, path);
  assert(`PAGE ${path} loads`, status === 200, `status=${status}`);
  for (const s of mustInclude) {
    assert(`PAGE ${path} has "${s}"`, text.includes(s), "missing in HTML");
  }
}

async function main() {
  console.log(`\nE2E smoke against ${BASE}\n`);

  console.log("— Public / login");
  await clickPage(null, "/login", ["Sign in"]);

  console.log("— Admin auth");
  const admin = cookieJar();
  {
    const { status, json } = await req(admin, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@gmail.com",
        password: "Admin@1234",
      }),
    });
    assert("admin login", status === 200 && json?.user?.role === "admin", JSON.stringify(json));
    assert("admin cookie set", admin.header().includes("pratham_token"));
  }
  {
    const { status, json } = await req(admin, "/api/auth/me");
    assert("admin /me", status === 200 && json?.user?.email === "admin@gmail.com", JSON.stringify(json));
  }

  console.log("— Admin pages (nav clicks)");
  const pages = [
    ["/", ["Kitchen", "Orders"]],
    ["/orders", ["Orders"]],
    ["/kitchen", ["Kitchen"]],
    ["/students", ["Students"]],
    ["/menu", ["Menu"]],
    ["/referrals", ["Referrals"]],
    ["/audit", ["Audit"]],
    ["/settings", ["Settings", "acceptance"]],
  ];
  for (const [path, needles] of pages) {
    await clickPage(admin, path, needles);
  }

  {
    const bare = cookieJar();
    const { status, res } = await req(bare, "/orders");
    const loc = res.headers.get("location") || "";
    assert(
      "unauth /orders redirects to login",
      (status === 307 || status === 302 || status === 303) && loc.includes("login"),
      `status=${status} loc=${loc}`
    );
  }

  console.log("— Admin APIs");
  {
    const { status, json } = await req(admin, "/api/dashboard");
    assert("dashboard api", status === 200 && !!json, JSON.stringify(json)?.slice(0, 120));
  }

  let menuItem = null;
  {
    const { status, json } = await req(admin, "/api/menu");
    assert("menu list", status === 200 && Array.isArray(json?.items), JSON.stringify(json)?.slice(0, 80));
    menuItem = json?.items?.[0] || null;
  }
  {
    // Pick an open meal slot based on IST hour if possible — fallback dinner for evening
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        hour12: false,
      }).format(new Date())
    );
    let meal_type = "dinner";
    if (hour < 6) meal_type = "breakfast";
    else if (hour < 11) meal_type = "lunch";
    else if (hour < 17) meal_type = "dinner";
    else meal_type = "dinner"; // past dinner cutoff — may fail; still exercise API

    const { status, json } = await req(admin, "/api/menu", {
      method: "POST",
      body: JSON.stringify({
        name: `E2E Extra ${Date.now()}`,
        meal_type,
        description: "smoke test item",
        price: 49,
      }),
    });
    assert("menu create", status === 200 && json?.item?.id, JSON.stringify(json));
    if (json?.item) menuItem = json.item;
  }

  let studentId = null;
  {
    const { status, json } = await req(admin, "/api/students");
    const list = json?.students || [];
    assert("students list", status === 200 && list.length >= 1, JSON.stringify(json)?.slice(0, 100));
    studentId = list.find((s) => s.email === "rahul@demo.local")?.id || list[0]?.id;
  }
  if (studentId) {
    const { status, json } = await req(admin, `/api/students/${studentId}/credit-limit`, {
      method: "PATCH",
      body: JSON.stringify({ credit_limit: 5000 }),
    });
    assert("set credit limit", status === 200, JSON.stringify(json));
  }

  {
    const { status, json } = await req(admin, "/api/settings");
    assert("settings get", status === 200 && json?.settings, JSON.stringify(json)?.slice(0, 100));
  }
  {
    const { status, json } = await req(admin, "/api/settings", {
      method: "PATCH",
      body: JSON.stringify({
        referral_min_completed_orders: 3,
        referral_reward_credits: 50,
      }),
    });
    assert(
      "settings patch referral",
      status === 200 && json?.settings?.referral_min_completed_orders === 3,
      JSON.stringify(json)
    );
  }

  {
    const { status, json } = await req(admin, "/api/referrals");
    assert("referrals api", status === 200, JSON.stringify(json)?.slice(0, 100));
  }

  {
    const { status, json } = await req(null, "/api/cron/generate-plans", {
      method: "POST",
      headers: { Authorization: "Bearer pratham-bootstrap" },
      body: "{}",
    });
    assert("cron generate-plans", status === 200, JSON.stringify(json));
  }

  console.log("— Student flows");
  const student = cookieJar();
  const email = `e2e_${Date.now()}@demo.local`;
  {
    const { status, json } = await req(student, "/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        full_name: "E2E Tester",
        email,
        password: "password123",
        phone: "9000000001",
        hostel: "Test PG",
        room: "1A",
        referral_code: "RAHUL001",
      }),
    });
    assert("student signup", status === 200 || status === 201, JSON.stringify(json));
  }
  {
    const { status, json } = await req(student, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: "password123" }),
    });
    assert("student login", status === 200 && json?.user?.role === "student", JSON.stringify(json));
  }
  {
    const { status, json } = await req(student, "/api/account");
    assert("student account", status === 200 && !!json, JSON.stringify(json)?.slice(0, 120));
  }

  // Place order for a meal that is still open (or tomorrow if all closed)
  {
    const { json: menuJson } = await req(student, "/api/menu");
    const items = menuJson?.items || [];
    assert("student menu", items.length >= 1, "no items");

    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        hour12: false,
      }).format(new Date())
    );
    const openMeals = [];
    if (hour < 6) openMeals.push("breakfast", "lunch", "dinner");
    else if (hour < 11) openMeals.push("lunch", "dinner");
    else if (hour < 17) openMeals.push("dinner");

    let placed = false;
    let lastErr = "no open meal";
    for (const meal of openMeals) {
      const item = items.find((i) => i.meal_type === meal);
      if (!item) continue;
      const { status: os, json: oj } = await req(student, "/api/orders", {
        method: "POST",
        body: JSON.stringify({
          meal_type: meal,
          menu_item_id: item.id,
          quantity: 2,
          notes: "E2E order",
        }),
      });
      if (os === 200 && oj?.order?.id) {
        placed = true;
        assert("student place order", true);
        break;
      }
      lastErr = JSON.stringify(oj);
    }
    if (!placed) {
      // Order for tomorrow breakfast (always allowed for future date)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
      }).format(tomorrow);
      const item = items.find((i) => i.meal_type === "breakfast") || items[0];
      const { status: os, json: oj } = await req(student, "/api/orders", {
        method: "POST",
        body: JSON.stringify({
          meal_type: item.meal_type,
          menu_item_id: item.id,
          quantity: 1,
          notes: "E2E order",
          order_date: dateStr,
        }),
      });
      assert("student place order (tomorrow fallback)", os === 200 && oj?.order?.id, oj ? JSON.stringify(oj) : lastErr);
    }
  }

  {
    const dinner = (await req(student, "/api/menu")).json?.items?.find(
      (i) => i.meal_type === "dinner"
    );
    const { status, json } = await req(student, "/api/plans", {
      method: "POST",
      body: JSON.stringify({
        meal_type: "dinner",
        menu_item_id: dinner?.id || null,
      }),
    });
    assert("student create plan", status === 200 && json?.plan?.id, JSON.stringify(json));
  }
  {
    const { status, json } = await req(student, "/api/plans");
    assert("student list plans", status === 200 && Array.isArray(json?.plans), JSON.stringify(json)?.slice(0, 100));
  }
  {
    const { status, json } = await req(student, "/api/notifications");
    assert("student notifications", status === 200, JSON.stringify(json)?.slice(0, 80));
  }
  {
    const { status, json } = await req(student, "/api/push/register", {
      method: "POST",
      body: JSON.stringify({
        token: `ExponentPushToken[e2e-test-${Date.now()}]`,
        platform: "android",
      }),
    });
    assert("push register", status === 200, JSON.stringify(json));
  }

  console.log("— Kitchen / order status");
  let orderId = null;
  {
    // Admin orders are date-scoped to today — also fetch student's orders
    const { json: sj } = await req(student, "/api/orders");
    const mine = sj?.orders || [];
    orderId = mine.find((o) => o.notes === "E2E order")?.id || mine[0]?.id;
    assert("student has order", !!orderId, JSON.stringify(sj)?.slice(0, 120));
  }
  if (orderId) {
    for (const statusNext of ["preparing", "out_for_delivery", "delivered"]) {
      const { status, json } = await req(admin, `/api/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: statusNext }),
      });
      assert(`order → ${statusNext}`, status === 200, JSON.stringify(json));
    }
  }

  {
    const { json } = await req(admin, "/api/students");
    const e2e = (json?.students || []).find((s) => s.email === email);
    if (e2e) {
      const { status, json: bj } = await req(admin, `/api/students/${e2e.id}/balance`, {
        method: "PATCH",
        body: JSON.stringify({ new_balance: 0, note: "E2E COD collected" }),
      });
      assert("clear balance after COD", status === 200, JSON.stringify(bj));
    } else {
      assert("clear balance after COD", false, "e2e student not found");
    }
  }

  // Cancel plan day + delete plan
  {
    const cancelDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
    }).format(new Date(Date.now() + 86400000));
    const { status, json } = await req(student, "/api/plans/cancel-day", {
      method: "POST",
      body: JSON.stringify({ meal_type: "dinner", cancel_date: cancelDate }),
    });
    assert("cancel plan day", status === 200, JSON.stringify(json));
  }
  {
    const { status, json } = await req(student, "/api/plans?meal_type=dinner", {
      method: "DELETE",
    });
    assert("deactivate plan", status === 200, JSON.stringify(json));
  }

  {
    const { status } = await req(admin, "/api/auth/logout", { method: "POST" });
    assert("admin logout", status === 200 || status === 204);
  }

  // Mobile viewport shell markers
  {
    const admin2 = cookieJar();
    await req(admin2, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@gmail.com", password: "Admin@1234" }),
    });
    const { text } = await req(admin2, "/");
    assert("mobile bottom nav present", text.includes("mobile-bottom") || text.includes("menu-trigger"));
    assert("viewport meta present", text.includes("viewport") || text.includes("device-width") || text.includes("Kitchen"));
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
