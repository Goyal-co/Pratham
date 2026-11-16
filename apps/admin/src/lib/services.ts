import type { PoolClient } from "pg";
import { query, withTransaction } from "@pratham/db";
import {
  getZonedParts,
  isMealOpen,
  wouldExceedCreditLimit,
  type MealType,
} from "@pratham/shared";
import { writeAudit } from "./audit";
import { cached, cacheDel } from "./cache";
import { sendExpoPush } from "./push";

export async function getStudentHeldBalance(_studentId: string) {
  // Holds removed — wallet is charged immediately. Kept for API compat.
  return 0;
}

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
  void sendExpoPush([userId], title, body, data).catch(() => undefined);
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
    const wallet = Number(acct.wallet_credit);
    const limit = Number(acct.credit_limit);

    if (wouldExceedCreditLimit(wallet, gross, limit)) {
      throw new Error(
        "Credit limit reached. Pay dues (top up wallet) before ordering."
      );
    }

    const walletAfter = wallet - gross;
    // prepaid portion used (for display); rest is borrowed (wallet goes negative)
    const walletApplied = Math.min(Math.max(wallet, 0), gross);
    const payable = gross - walletApplied;

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
       set wallet_credit = $1, outstanding_balance = 0, updated_at = now()
       where student_id = $2`,
      [walletAfter, input.studentId]
    );

    await client.query(
      `insert into ledger_entries (student_id, entry_type, amount, order_id, note, created_by)
       values ($1,'order_charge',$2,$3,$4,$1)`,
      [
        input.studentId,
        -gross,
        order.id,
        `${input.mealType} order · wallet ${wallet.toFixed(0)} → ${walletAfter.toFixed(0)}`,
      ]
    );

    await client.query(
      `insert into notifications (user_id, title, body, data)
       values ($1,$2,$3,$4)`,
      [
        input.studentId,
        "Order placed",
        `${input.mealType} x${input.quantity} for ${orderDate} · ₹${gross} charged to wallet`,
        JSON.stringify({ order_id: order.id, type: "order_placed" }),
      ]
    );

    return order;
  }).then((order) => {
    void sendExpoPush(
      [input.studentId],
      "Order placed",
      `${input.mealType} x${input.quantity} · charged to wallet`,
      { order_id: order.id, type: "order_placed" }
    ).catch(() => undefined);
    return order;
  });
}

/** Cancel an open order and refund the full gross back to wallet. */
export async function cancelOrderWithRefund(
  orderId: string,
  studentId?: string,
  opts?: { allowStatuses?: string[] }
) {
  const allow = opts?.allowStatuses ?? ["placed", "preparing"];
  return withTransaction(async (client) => {
    const prev = await client.query(
      `select * from orders where id = $1 for update`,
      [orderId]
    );
    const order = prev.rows[0];
    if (!order) throw new Error("Order not found");
    if (studentId && order.student_id !== studentId) {
      throw new Error("Order not found");
    }
    if (order.status === "cancelled") return order;
    if (order.status === "delivered") {
      throw new Error("Cannot cancel — already delivered");
    }
    if (order.status === "out_for_delivery" && !allow.includes("out_for_delivery")) {
      throw new Error("Cannot cancel — meal is out for delivery");
    }
    if (!allow.includes(order.status)) {
      throw new Error(`Cannot cancel order in status ${order.status}`);
    }

    const refund = Number(order.gross_amount);

    await client.query(
      `update orders set status = 'cancelled', updated_at = now() where id = $1`,
      [orderId]
    );

    if (refund > 0) {
      await client.query(
        `update student_accounts
         set wallet_credit = wallet_credit + $1, outstanding_balance = 0, updated_at = now()
         where student_id = $2`,
        [refund, order.student_id]
      );
      await client.query(
        `insert into ledger_entries (student_id, entry_type, amount, order_id, note, created_by)
         values ($1,'adjustment',$2,$3,'Order cancelled — refunded to wallet',$1)`,
        [order.student_id, refund, orderId]
      );
    }

    return { ...order, status: "cancelled" };
  });
}

/** Cancel open fixed-plan / adhoc orders for a student meal on a date and refund. */
export async function cancelOpenOrdersForMealDate(input: {
  studentId: string;
  mealType: MealType;
  orderDate: string;
  source?: "fixed_plan" | "adhoc" | "any";
}) {
  const params: unknown[] = [input.studentId, input.mealType, input.orderDate];
  let sourceSql = "";
  if (input.source && input.source !== "any") {
    params.push(input.source);
    sourceSql = ` and source = $${params.length}`;
  }
  const { rows } = await query(
    `select id from orders
     where student_id = $1 and meal_type = $2 and order_date = $3::date
       and status in ('placed','preparing')${sourceSql}`,
    params
  );
  let cancelled = 0;
  for (const row of rows) {
    await cancelOrderWithRefund(row.id, input.studentId);
    cancelled += 1;
  }
  return cancelled;
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
    if (order.status === status) return { prev: order, next: order };

    const updated = await client.query(
      `update orders set status = $1, updated_at = now() where id = $2 returning *`,
      [status, orderId]
    );
    const next = updated.rows[0];
    const refund = Number(order.gross_amount);

    // Money already moved on place — delivery only completes the meal.
    if (
      status === "delivered" &&
      order.status !== "delivered" &&
      order.status !== "cancelled"
    ) {
      await maybeAwardReferral(client, order.student_id, adminId);
    }

    // Admin cancel while open → refund gross to wallet.
    if (
      status === "cancelled" &&
      ["placed", "preparing", "out_for_delivery"].includes(order.status)
    ) {
      if (refund > 0) {
        await client.query(
          `update student_accounts
           set wallet_credit = wallet_credit + $1, outstanding_balance = 0, updated_at = now()
           where student_id = $2`,
          [refund, order.student_id]
        );
        await client.query(
          `insert into ledger_entries (student_id, entry_type, amount, order_id, note, created_by)
           values ($1,'adjustment',$2,$3,'Admin cancelled — refunded to wallet',$4)`,
          [order.student_id, refund, orderId, adminId]
        );
      }
    }

    await client.query(
      `insert into notifications (user_id, title, body, data)
       values ($1,'Order update',$2,$3)`,
      [
        order.student_id,
        `Your ${order.meal_type} order is now ${status.replaceAll("_", " ")}`,
        JSON.stringify({ type: "order_status", order_id: orderId, status }),
      ]
    );

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
