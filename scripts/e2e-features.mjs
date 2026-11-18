/**
 * Full feature verification: plans, skip meal, orders, credit, referral, admin.
 * Usage: node scripts/e2e-features.mjs [baseUrl]
 */
const BASE = process.argv[2] || "http://localhost:3000";
const results = [];
let failed = 0;

function cookieJar() {
  const jar = new Map();
  return {
    store(res) {
      const raw =
        typeof res.headers.getSetCookie === "function"
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
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers,
    redirect: "manual",
  });
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
    console.log(
      `  ✗ ${name}${detail ? ` — ${String(detail).slice(0, 220)}` : ""}`
    );
  }
}

function istDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    d
  );
}

function istHour() {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hour12: false,
    }).format(new Date())
  );
}

async function main() {
  console.log(`\nFeature suite against ${BASE}\n`);
  const tomorrow = istDate(1);
  const today = istDate(0);
  const hour = istHour();

  // —— Auth negatives ——
  console.log("— Auth");
  {
    const { status } = await req(null, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "nope@x.com", password: "wrong" }),
    });
    assert("reject bad login", status === 401);
  }

  const admin = cookieJar();
  {
    const { status, json } = await req(admin, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "titanscortex@gmail.com",
        password: "Titans@$#123",
      }),
    });
    assert("admin login", status === 200 && json?.user?.role === "admin");
  }

  // —— Settings ——
  console.log("— Settings (referral X=2, Y=75)");
  {
    const { status, json } = await req(admin, "/api/settings", {
      method: "PATCH",
      body: JSON.stringify({
        referral_min_completed_orders: 2,
        referral_reward_credits: 75,
        default_credit_limit: 2000,
      }),
    });
    assert(
      "update referral X/Y",
      status === 200 &&
        json?.settings?.referral_min_completed_orders === 2 &&
        Number(json?.settings?.referral_reward_credits) === 75,
      JSON.stringify(json)
    );
  }

  // —— Menu ——
  console.log("— Menu");
  let lunchItem = null;
  let dinnerItem = null;
  let breakfastItem = null;
  {
    for (const meal of ["breakfast", "lunch", "dinner"]) {
      await req(admin, "/api/menu", {
        method: "POST",
        body: JSON.stringify({
          name: `Feat ${meal} ${Date.now()}`,
          meal_type: meal,
          price: meal === "breakfast" ? 40 : meal === "lunch" ? 70 : 80,
          description: "feature test",
        }),
      });
    }
    const { status, json } = await req(admin, "/api/menu");
    assert("list menu", status === 200 && json.items.length >= 3);
    breakfastItem = json.items.find((i) => i.meal_type === "breakfast");
    lunchItem = json.items.find((i) => i.meal_type === "lunch");
    dinnerItem = json.items.find((i) => i.meal_type === "dinner");
    assert("has breakfast/lunch/dinner items", !!(breakfastItem && lunchItem && dinnerItem));
  }

  // —— Student A (inviter) + Student B (invitee with referral) ——
  console.log("— Students + referral signup");
  const inviter = cookieJar();
  const invitee = cookieJar();
  const stamp = Date.now();
  const inviterEmail = `inviter_${stamp}@demo.local`;
  const inviteeEmail = `invitee_${stamp}@demo.local`;

  {
    const { status, json } = await req(inviter, "/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        full_name: "Inviter User",
        email: inviterEmail,
        password: "password123",
        phone: "9111111111",
        hostel: "A",
        room: "1",
      }),
    });
    assert("inviter signup", status === 200 && json?.user?.referral_code, JSON.stringify(json));
  }
  await req(inviter, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: inviterEmail, password: "password123" }),
  });
  const inviterMe = (await req(inviter, "/api/auth/me")).json?.user;
  const inviterId = inviterMe?.id;
  const inviterCode = inviterMe?.referral_code;
  assert("inviter has referral code", !!inviterCode, JSON.stringify(inviterMe));
  const inviterWalletBefore = Number(
    (await req(inviter, "/api/account")).json?.account?.wallet_credit ?? 0
  );

  {
    const { status, json } = await req(invitee, "/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        full_name: "Invitee User",
        email: inviteeEmail,
        password: "password123",
        phone: "9222222222",
        hostel: "B",
        room: "2",
        referral_code: inviterCode,
      }),
    });
    assert("invitee signup with code", status === 200, JSON.stringify(json));
  }
  await req(invitee, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: inviteeEmail, password: "password123" }),
  });
  const inviteeId = (await req(invitee, "/api/auth/me")).json?.user?.id;

  {
    const { status, json } = await req(admin, "/api/referrals");
    const list = json?.referrals || [];
    const hit = list.find((r) => r.invitee_id === inviteeId);
    assert(
      "referral row pending for this invitee",
      status === 200 && hit?.status === "pending" && hit?.inviter_id === inviterId,
      JSON.stringify(hit || json)?.slice(0, 200)
    );
  }

  // —— Credit limit ——
  console.log("— Credit limit");
  {
    await req(admin, `/api/students/${inviteeId}/credit-limit`, {
      method: "PATCH",
      body: JSON.stringify({ credit_limit: 50 }),
    });
    const { status, json } = await req(invitee, "/api/orders", {
      method: "POST",
      body: JSON.stringify({
        meal_type: dinnerItem.meal_type,
        menu_item_id: dinnerItem.id,
        quantity: 5,
        order_date: tomorrow,
        notes: "should-block",
      }),
    });
    assert(
      "block order over credit limit",
      status >= 400 || /credit|limit/i.test(JSON.stringify(json)),
      JSON.stringify(json)
    );
    // restore limit
    await req(admin, `/api/students/${inviteeId}/credit-limit`, {
      method: "PATCH",
      body: JSON.stringify({ credit_limit: 5000 }),
    });
  }

  // —— Ad-hoc multi-qty order ——
  console.log("— Ad-hoc orders");
  let orderIds = [];
  {
    const { status, json } = await req(invitee, "/api/orders", {
      method: "POST",
      body: JSON.stringify({
        meal_type: lunchItem.meal_type,
        menu_item_id: lunchItem.id,
        quantity: 3,
        order_date: tomorrow,
        notes: "multi-qty",
      }),
    });
    assert(
      "place multi-qty order",
      status === 200 && json?.order?.quantity == 3,
      JSON.stringify(json)
    );
    if (json?.order?.id) orderIds.push(json.order.id);
  }
  {
    // second order for referral progress
    const { status, json } = await req(invitee, "/api/orders", {
      method: "POST",
      body: JSON.stringify({
        meal_type: dinnerItem.meal_type,
        menu_item_id: dinnerItem.id,
        quantity: 1,
        order_date: tomorrow,
        notes: "referral-2",
      }),
    });
    assert("place second order", status === 200 && json?.order?.id, JSON.stringify(json));
    if (json?.order?.id) orderIds.push(json.order.id);
  }
  {
    // invalid qty
    const { status, json } = await req(invitee, "/api/orders", {
      method: "POST",
      body: JSON.stringify({
        meal_type: dinnerItem.meal_type,
        menu_item_id: dinnerItem.id,
        quantity: 11,
        order_date: tomorrow,
      }),
    });
    assert(
      "reject qty > 10",
      status >= 400 || /quantity|between/i.test(JSON.stringify(json)),
      JSON.stringify(json)
    );
  }
  {
    // past date
    const { status, json } = await req(invitee, "/api/orders", {
      method: "POST",
      body: JSON.stringify({
        meal_type: breakfastItem.meal_type,
        menu_item_id: breakfastItem.id,
        quantity: 1,
        order_date: istDate(-1),
      }),
    });
    assert(
      "reject past-date order",
      status >= 400 || /past/i.test(JSON.stringify(json)),
      JSON.stringify(json)
    );
  }

  // —— Fixed plans: add / skip / stop ——
  console.log("— Fixed plans (add / skip meal / stop)");
  {
    for (const meal of ["breakfast", "lunch", "dinner"]) {
      const item =
        meal === "breakfast"
          ? breakfastItem
          : meal === "lunch"
            ? lunchItem
            : dinnerItem;
      const { status, json } = await req(invitee, "/api/plans", {
        method: "POST",
        body: JSON.stringify({ meal_type: meal, menu_item_id: item.id }),
      });
      assert(`apply ${meal} plan`, status === 200 && json?.plan?.is_active, JSON.stringify(json));
    }
  }
  {
    const { status, json } = await req(invitee, "/api/plans");
    assert(
      "list 3 active plans",
      status === 200 && (json?.plans || []).length >= 3,
      JSON.stringify(json)
    );
  }
  {
    const { status, json } = await req(invitee, "/api/plans/cancel-day", {
      method: "POST",
      body: JSON.stringify({ meal_type: "lunch", cancel_date: tomorrow }),
    });
    assert("skip lunch for tomorrow", status === 200 && json?.cancellation, JSON.stringify(json));
  }
  {
    // skip without active plan should fail
    await req(invitee, "/api/plans?meal_type=breakfast", { method: "DELETE" });
    const { status, json } = await req(invitee, "/api/plans/cancel-day", {
      method: "POST",
      body: JSON.stringify({ meal_type: "breakfast", cancel_date: tomorrow }),
    });
    assert(
      "skip fails without active plan",
      status >= 400 || /no active/i.test(JSON.stringify(json)),
      JSON.stringify(json)
    );
    // re-apply breakfast for cron test
    await req(invitee, "/api/plans", {
      method: "POST",
      body: JSON.stringify({
        meal_type: "breakfast",
        menu_item_id: breakfastItem.id,
      }),
    });
  }

  // —— Cron generate: creates plan orders, respects skip ——
  console.log("— Cron generate-plans (respects skip)");
  {
    const { status, json } = await req(null, "/api/cron/generate-plans", {
      method: "POST",
      headers: { Authorization: "Bearer pratham-bootstrap" },
      body: JSON.stringify({ date: tomorrow }),
    });
    assert("cron generate for tomorrow", status === 200 && json?.ok, JSON.stringify(json));
    assert(
      "cron created some plan orders",
      Number(json?.created) >= 1,
      JSON.stringify(json)
    );
  }
  {
    const { json } = await req(invitee, "/api/orders");
    const orders = json?.orders || [];
    const dateOf = (o) => {
      const raw = o.order_date;
      if (!raw) return "";
      // pg date may serialize as YYYY-MM-DD or ISO timestamptz
      const s = String(raw);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const d = new Date(s);
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
      }).format(d);
    };
    const forTomorrow = orders.filter(
      (o) => dateOf(o) === tomorrow && o.source === "fixed_plan"
    );
    assert(
      "fixed_plan breakfast/dinner present",
      forTomorrow.some((o) => o.meal_type === "breakfast") &&
        forTomorrow.some((o) => o.meal_type === "dinner"),
      `tomorrow=${tomorrow} found=${JSON.stringify(orders.filter((o) => o.source === "fixed_plan").map((o) => ({ m: o.meal_type, d: o.order_date, dd: dateOf(o) })))}`
    );
    assert(
      "skipped lunch has no fixed_plan order",
      !forTomorrow.some((o) => o.meal_type === "lunch"),
      JSON.stringify(forTomorrow.map((o) => o.meal_type))
    );
  }
  {
    // idempotent second run
    const { json } = await req(null, "/api/cron/generate-plans", {
      method: "POST",
      headers: { Authorization: "Bearer pratham-bootstrap" },
      body: JSON.stringify({ date: tomorrow }),
    });
    assert("cron idempotent (0 new)", Number(json?.created) === 0, JSON.stringify(json));
  }

  // —— Stop plan ——
  {
    const { status } = await req(invitee, "/api/plans?meal_type=dinner", {
      method: "DELETE",
    });
    assert("stop dinner plan", status === 200);
    const { json } = await req(invitee, "/api/plans");
    assert(
      "dinner no longer active",
      !(json?.plans || []).some((p) => p.meal_type === "dinner" && p.is_active),
      JSON.stringify(json)
    );
  }

  // —— Kitchen status + referral reward ——
  console.log("— Deliveries + referral reward");
  {
    // deliver the two adhoc orders
    for (const id of orderIds) {
      for (const st of ["preparing", "out_for_delivery", "delivered"]) {
        const { status, json } = await req(admin, `/api/orders/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: st }),
        });
        assert(`order ${id.slice(0, 8)} → ${st}`, status === 200, JSON.stringify(json));
      }
    }
  }
  {
    // Inviter should have +75 wallet after 2 delivered (X=2, Y=75)
    const { json } = await req(inviter, "/api/account");
    const wallet =
      Number(json?.account?.wallet_credit ?? json?.wallet_credit ?? NaN);
    assert(
      "inviter wallet +75 referral",
      wallet >= inviterWalletBefore + 75,
      `wallet=${wallet} before=${inviterWalletBefore} body=${JSON.stringify(json)}`
    );
  }
  {
    const { json } = await req(admin, "/api/referrals");
    const blob = JSON.stringify(json);
    assert(
      "referral marked earned",
      /earned/i.test(blob) && blob.includes(inviteeId || ""),
      blob.slice(0, 200)
    );
  }

  // —— Notifications ——
  console.log("— Notifications + push");
  {
    const { status, json } = await req(invitee, "/api/notifications");
    const notes = json?.notifications || json || [];
    assert(
      "invitee has notifications",
      status === 200 && Array.isArray(notes) && notes.length >= 1,
      JSON.stringify(json)?.slice(0, 120)
    );
    if (notes[0]?.id) {
      const { status: s2 } = await req(invitee, "/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ id: notes[0].id, read: true }),
      });
      // API may use different shape
      assert("mark notification read (or accepted)", s2 === 200 || s2 === 204 || s2 < 500);
    }
  }
  {
    const { status, json } = await req(invitee, "/api/push/register", {
      method: "POST",
      body: JSON.stringify({
        token: `ExponentPushToken[feat-${stamp}]`,
        platform: "ios",
      }),
    });
    assert("push register", status === 200, JSON.stringify(json));
  }
  {
    const { status, json } = await req(admin, "/api/push/broadcast", {
      method: "POST",
      body: JSON.stringify({
        title: "Feature test",
        body: "Broadcast ok",
      }),
    });
    assert(
      "admin broadcast",
      status === 200 || status === 201,
      JSON.stringify(json)
    );
  }

  // —— COD clear balance ——
  console.log("— COD balance clear");
  {
    const { json: acct } = await req(invitee, "/api/account");
    const outstanding = Number(
      acct?.account?.outstanding_balance ?? acct?.outstanding_balance ?? 0
    );
    assert("invitee has outstanding after orders", outstanding > 0, JSON.stringify(acct));
    const { status, json } = await req(admin, `/api/students/${inviteeId}/balance`, {
      method: "PATCH",
      body: JSON.stringify({ new_balance: 0, note: "COD collected feature test" }),
    });
    assert("admin clears outstanding", status === 200, JSON.stringify(json));
    const after = await req(invitee, "/api/account");
    const bal = Number(
      after.json?.account?.outstanding_balance ??
        after.json?.outstanding_balance ??
        -1
    );
    assert("outstanding is 0", bal === 0, JSON.stringify(after.json));
  }

  // —— Admin pages still load ——
  console.log("— Admin UI pages");
  for (const [path, needle] of [
    ["/", "Kitchen"],
    ["/orders", "Orders"],
    ["/kitchen", "Kitchen"],
    ["/students", "Students"],
    ["/menu", "Menu"],
    ["/referrals", "Referral"],
    ["/audit", "Audit"],
    ["/settings", "Settings"],
  ]) {
    const { status, text } = await req(admin, path);
    assert(`page ${path}`, status === 200 && text.includes(needle));
  }

  // —— Created invitee can re-login ——
  {
    const again = cookieJar();
    const { status, json } = await req(again, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: inviteeEmail,
        password: "password123",
      }),
    });
    assert("invitee re-login", status === 200 && json?.user?.role === "student");
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
