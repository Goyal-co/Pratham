import type { PoolClient } from "pg";
import { query, withTransaction } from "@pratham/db";
import {
  applyWallet,
  getZonedParts,
  isMealOpen,
  wouldExceedCreditLimit,
  type MealType,
} from "@pratham/shared";
import { writeAudit } from "./audit";
import { cached, cacheDel } from "./cache";
import { sendExpoPush } from "./push";

export type AppSettingsRow = {
  breakfast_cutoff: string;
  lunch_cutoff: string;
  dinner_cutoff: string;
  referral_min_completed_orders: number;
  referral_reward_credits: number;
  default_credit_limit: number;
  reminder_lead_minutes?: number;
  timezone: string;
};

export async function getSettings() {
  return cached("settings", 30_000, async () => {
    const { rows } = await query<AppSettingsRow>(
      `select * from app_settings where id = 1`
    );
    return rows[0];
  });
}

export function invalidateSettingsCache() {
  cacheDel("settings");
}

export async function notifyUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  await query(
    `insert into notifications (user_id, title, body, data) values ($1,$2,$3,$4)`,
    [userId, title, body, data ? JSON.stringify(data) : null]
  );
  await sendExpoPush([userId], title, body, data).catch(() => undefined);
}

export async function notifyAllStudents(
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  const { rows } = await query<{ id: string }>(
    `select id from users where role = 'student'`
  );
  const ids = rows.map((r) => r.id);
  if (!ids.length) return { recipients: 0, pushes: 0 };
  await query(
    `insert into notifications (user_id, title, body, data)
     select id, $1, $2, $3 from users where role = 'student'`,
    [title, body, data ? JSON.stringify(data) : null]
  );
  const push = await sendExpoPush(ids, title, body, data).catch(() => ({
    pushes: 0,
  }));
  return { recipients: ids.length, pushes: push.pushes ?? 0 };
}

function cutoffsFromSettings(s: {
  breakfast_cutoff: string;
  lunch_cutoff: string;
  dinner_cutoff: string;
}) {
  return {
    breakfast: s.breakfast_cutoff,
    lunch: s.lunch_cutoff,
    dinner: s.dinner_cutoff,
  } as Record<MealType, string>;
}

export async function placeOrder(input: {
  studentId: string;
  mealType: MealType;
  menuItemId?: string | null;
  quantity: number;
  notes?: string | null;
  orderDate?: string;
  source?: "adhoc" | "fixed_plan";
}) {
  const settings = await getSettings();
  const cutoffs = cutoffsFromSettings(settings);
  const { dateStr } = getZonedParts(new Date(), settings.timezone || "Asia/Kolkata");
  const orderDate = input.orderDate || dateStr;
  const source = input.source || "adhoc";

  if (orderDate < dateStr) throw new Error("Cannot order for a past date");
  if (
    orderDate === dateStr &&
    !isMealOpen(input.mealType, cutoffs, new Date(), settings.timezone)
  ) {
    throw new Error(`Ordering closed for ${input.mealType}`);
  }
  if (input.quantity < 1 || input.quantity > 10) {
    throw new Error("Quantity must be between 1 and 10");
  }

  return withTransaction(async (client) => {
    let itemRes = input.menuItemId
      ? await client.query(
          `select * from menu_items where id = $1 and is_active`,
          [input.menuItemId]
        )
      : await client.query(
          `select * from menu_items
           where meal_type = $1 and is_active and menu_date = $2::date
           order by created_at limit 1`,
          [input.mealType, orderDate]
        );
    if (!itemRes.rows[0]) {
      itemRes = await client.query(
        `select * from menu_items
         where meal_type = $1 and is_active and menu_date is null
         order by created_at limit 1`,
        [input.mealType]
      );
    }
    if (!itemRes.rows[0] && input.menuItemId) {
      itemRes = await client.query(
        `select * from menu_items where meal_type = $1 and is_active order by created_at limit 1`,
        [input.mealType]
      );
    }
    const item = itemRes.rows[0];
    if (!item) throw new Error("No active menu item");
    if (item.meal_type !== input.mealType) throw new Error("Meal type mismatch");

    const acctRes = await client.query(
      `select * from student_accounts where student_id = $1 for update`,
      [input.studentId]
    );
    const acct = acctRes.rows[0];
    if (!acct) throw new Error("Student account missing");

    const gross = Number(item.price) * input.quantity;
    const { walletApplied, payable, walletRemaining } = applyWallet(
      gross,
      Number(acct.wallet_credit)
    );
    if (
      wouldExceedCreditLimit(
        Number(acct.outstanding_balance),
        payable,
        Number(acct.credit_limit)
      )
    ) {
      throw new Error("Credit limit exceeded. Clear outstanding balance before ordering.");
    }

    const orderRes = await client.query(
      `insert into orders (
        student_id, meal_type, menu_item_id, quantity, unit_price,
        gross_amount, wallet_applied, payable_amount, source, order_date, notes
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      returning *`,
      [
        input.studentId,
        input.mealType,
        item.id,
        input.quantity,
        item.price,
        gross,
        walletApplied,
        payable,
        source,
        orderDate,
        input.notes ?? null,
      ]
    );
    const order = orderRes.rows[0];

    await client.query(
      `update student_accounts
       set wallet_credit = $1, outstanding_balance = outstanding_balance + $2, updated_at = now()
       where student_id = $3`,
      [walletRemaining, payable, input.studentId]
    );

    await client.query(
      `insert into ledger_entries (student_id, entry_type, amount, order_id, note, created_by)
       values ($1,'order_charge',$2,$3,'Order charge (COD)',$1)`,
      [input.studentId, payable, order.id]
    );
    if (walletApplied > 0) {
      await client.query(
        `insert into ledger_entries (student_id, entry_type, amount, order_id, note, created_by)
         values ($1,'wallet_applied',$2,$3,'Wallet credit applied',$1)`,
        [input.studentId, -walletApplied, order.id]
      );
    }

    await client.query(
      `insert into notifications (user_id, title, body, data)
       values ($1,$2,$3,$4)`,
      [
        input.studentId,
        "Order placed",
        `${input.mealType} x${input.quantity} confirmed for ${orderDate} (COD ₹${payable})`,
        JSON.stringify({ order_id: order.id, type: "order_placed" }),
      ]
    );

    return order;
  }).then(async (order) => {
    await sendExpoPush(
      [input.studentId],
      "Order placed",
      `${input.mealType} x${input.quantity} confirmed (COD)`,
      { order_id: order.id, type: "order_placed" }
    ).catch(() => undefined);
    return order;
  });
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
  adminId: string
) {
  return withTransaction(async (client) => {
    const prev = await client.query(`select * from orders where id = $1 for update`, [
      orderId,
    ]);
    const order = prev.rows[0];
    if (!order) throw new Error("Order not found");
    const updated = await client.query(
      `update orders set status = $1, updated_at = now() where id = $2 returning *`,
      [status, orderId]
    );
    const next = updated.rows[0];

    await client.query(
      `insert into notifications (user_id, title, body, data)
       values ($1,'Order update',$2,$3)`,
      [
        order.student_id,
        `Your ${order.meal_type} order is now ${status.replaceAll("_", " ")}`,
        JSON.stringify({ type: "order_status", order_id: orderId, status }),
      ]
    );

    if (status === "delivered" && order.status !== "delivered") {
      await maybeAwardReferral(client, order.student_id, adminId);
    }

    return { prev: order, next };
  }).then(async ({ prev, next }) => {
    await writeAudit({
      actorId: adminId,
      action: "order.status",
      entity: "order",
      entityId: orderId,
      before: { status: prev.status },
      after: { status: next.status },
    });
    await sendExpoPush(
      [next.student_id],
      "Order update",
      `Your ${next.meal_type} order is now ${status.replaceAll("_", " ")}`,
      { type: "order_status", order_id: orderId, status }
    ).catch(() => undefined);
    return next;
  });
}

async function maybeAwardReferral(
  client: PoolClient,
  inviteeId: string,
  adminId: string
) {
  const refRes = await client.query(
    `select * from referrals where invitee_id = $1 and status = 'pending' for update`,
    [inviteeId]
  );
  const ref = refRes.rows[0];
  if (!ref) return;

  const countRes = await client.query(
    `select count(*)::int as c from orders where student_id = $1 and status = 'delivered'`,
    [inviteeId]
  );
  const completed = countRes.rows[0].c as number;
  await client.query(`update referrals set completed_orders = $1 where id = $2`, [
    completed,
    ref.id,
  ]);

  const settingsRes = await client.query(`select * from app_settings where id = 1`);
  const settings = settingsRes.rows[0];
  if (completed < settings.referral_min_completed_orders) return;

  const earned = await client.query(
    `update referrals set status = 'earned', earned_at = now(), completed_orders = $1
     where id = $2 and status = 'pending' returning *`,
    [completed, ref.id]
  );
  if (!earned.rows[0]) return;

  await client.query(
    `update student_accounts set wallet_credit = wallet_credit + $1, updated_at = now()
     where student_id = $2`,
    [settings.referral_reward_credits, ref.inviter_id]
  );
  await client.query(
    `insert into ledger_entries (student_id, entry_type, amount, note, created_by)
     values ($1,'referral_credit',$2,$3,$4)`,
    [
      ref.inviter_id,
      settings.referral_reward_credits,
      `Referral reward for invitee completing ${settings.referral_min_completed_orders} orders`,
      adminId,
    ]
  );
  await client.query(
    `insert into notifications (user_id, title, body, data)
     values ($1,'Referral reward!',$2,$3)`,
    [
      ref.inviter_id,
      `You earned ₹${settings.referral_reward_credits} wallet credit for a successful referral.`,
      JSON.stringify({
        type: "referral_reward",
        amount: Number(settings.referral_reward_credits),
      }),
    ]
  );
}

export async function generateFixedPlanOrders(date?: string) {
  const settings = await getSettings();
  const { dateStr } = getZonedParts(new Date(), settings.timezone || "Asia/Kolkata");
  const target = date || dateStr;
  const { rows: plans } = await query(
    `select * from fixed_plans where is_active = true`
  );
  let created = 0;
  for (const plan of plans) {
    const skipped = await query(
      `select 1 from plan_cancellations
       where student_id = $1 and meal_type = $2 and cancel_date = $3`,
      [plan.student_id, plan.meal_type, target]
    );
    if (skipped.rowCount) continue;
    const existing = await query(
      `select 1 from orders
       where student_id = $1 and meal_type = $2 and order_date = $3
         and source = 'fixed_plan' and status <> 'cancelled'`,
      [plan.student_id, plan.meal_type, target]
    );
    if (existing.rowCount) continue;
    try {
      await placeOrder({
        studentId: plan.student_id,
        mealType: plan.meal_type,
        menuItemId: plan.menu_item_id,
        quantity: 1,
        orderDate: target,
        source: "fixed_plan",
      });
      created += 1;
    } catch {
      /* credit/cutoff skip */
    }
  }
  return created;
}
