import { query } from "@pratham/db";
import { creditAvailable, debtFromWallet } from "@pratham/shared";

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { start, end, year: y, month: m, daysInMonth: last };
}

export async function getStudentHistory(input: {
  studentId: string;
  month: string;
  meal?: string | null;
  status?: string | null;
  source?: string | null;
  date?: string | null;
  entryType?: string | null;
}) {
  const { start, end, daysInMonth, year, month } = monthBounds(input.month);
  const params: unknown[] = [input.studentId, start, end];
  const filters: string[] = [
    "o.student_id = $1",
    "o.order_date >= $2::date",
    "o.order_date <= $3::date",
  ];

  if (input.meal && input.meal !== "all") {
    params.push(input.meal);
    filters.push(`o.meal_type = $${params.length}`);
  }
  if (input.status && input.status !== "all") {
    params.push(input.status);
    filters.push(`o.status = $${params.length}`);
  }
  if (input.source && input.source !== "all") {
    params.push(input.source);
    filters.push(`o.source = $${params.length}`);
  }
  if (input.date) {
    params.push(input.date);
    filters.push(`o.order_date = $${params.length}::date`);
  }

  const where = filters.join(" and ");

  const ledgerParams: unknown[] = [input.studentId, start, end];
  let ledgerWhere = `l.student_id = $1
           and l.created_at >= ($2::date)::timestamptz
           and l.created_at < (($3::date) + interval '1 day')::timestamptz`;
  if (input.entryType && input.entryType !== "all") {
    ledgerParams.push(input.entryType);
    ledgerWhere += ` and l.entry_type = $${ledgerParams.length}`;
  }
  if (input.date) {
    ledgerParams.push(input.date);
    ledgerWhere += ` and (l.created_at at time zone 'Asia/Kolkata')::date = $${ledgerParams.length}::date`;
  }

  const [acctRes, calendarRes, ordersRes, ledgerRes, countRes] =
    await Promise.all([
      query(
        `select credit_limit, wallet_credit, updated_at
         from student_accounts where student_id = $1`,
        [input.studentId]
      ),
      query(
        `select o.order_date::text as order_date,
                count(*)::int as orders,
                count(*) filter (where o.status = 'delivered')::int as delivered,
                count(*) filter (where o.status = 'cancelled')::int as cancelled,
                count(*) filter (
                  where o.status in ('placed','preparing','out_for_delivery')
                )::int as open,
                coalesce(sum(o.gross_amount),0)::float8 as payable_sum
         from orders o
         where o.student_id = $1
           and o.order_date >= $2::date
           and o.order_date <= $3::date
         group by o.order_date
         order by o.order_date`,
        [input.studentId, start, end]
      ),
      query(
        `select o.*, mi.name as item_name, mi.price as item_price
         from orders o
         left join menu_items mi on mi.id = o.menu_item_id
         where ${where}
         order by o.order_date desc, o.created_at desc
         limit 200`,
        params
      ),
      query(
        `select l.*, o.meal_type, o.order_date::text as order_date, o.status as order_status
         from ledger_entries l
         left join orders o on o.id = l.order_id
         where ${ledgerWhere}
         order by l.created_at desc
         limit 200`,
        ledgerParams
      ),
      query(
        `select
           count(*)::int as orders_total,
           count(*) filter (where status = 'delivered')::int as delivered,
           count(*) filter (where status = 'cancelled')::int as cancelled,
           count(*) filter (
             where status in ('placed','preparing','out_for_delivery')
           )::int as open,
           count(*) filter (where source = 'fixed_plan')::int as plan_orders,
           count(*) filter (where source = 'adhoc')::int as adhoc_orders,
           coalesce(sum(gross_amount) filter (where status <> 'cancelled'),0)::float8 as charged_total
         from orders
         where student_id = $1
           and order_date >= $2::date
           and order_date <= $3::date`,
        [input.studentId, start, end]
      ),
    ]);

  const acct = acctRes.rows[0] ?? { credit_limit: 0, wallet_credit: 0 };
  const wallet = Number(acct.wallet_credit);
  const limit = Number(acct.credit_limit);
  const debt = debtFromWallet(wallet);

  const byDate = Object.fromEntries(
    calendarRes.rows.map((r) => [
      String(r.order_date).slice(0, 10),
      {
        orders: Number(r.orders),
        delivered: Number(r.delivered),
        cancelled: Number(r.cancelled),
        open: Number(r.open),
        payable_sum: Number(r.payable_sum),
      },
    ])
  );

  const calendar = Array.from({ length: daysInMonth }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    const date = `${year}-${String(month).padStart(2, "0")}-${day}`;
    return {
      date,
      day: i + 1,
      ...(byDate[date] || {
        orders: 0,
        delivered: 0,
        cancelled: 0,
        open: 0,
        payable_sum: 0,
      }),
    };
  });

  const counts = countRes.rows[0] || {
    orders_total: 0,
    delivered: 0,
    cancelled: 0,
    open: 0,
    plan_orders: 0,
    adhoc_orders: 0,
    charged_total: 0,
  };

  return {
    month: input.month,
    range: { start, end },
    account: {
      credit_limit: limit,
      wallet_credit: wallet,
      debt,
      credit_available: creditAvailable(wallet, limit),
      updated_at: acct.updated_at ?? null,
    },
    counts: {
      orders_total: Number(counts.orders_total),
      delivered: Number(counts.delivered),
      cancelled: Number(counts.cancelled),
      open: Number(counts.open),
      plan_orders: Number(counts.plan_orders),
      adhoc_orders: Number(counts.adhoc_orders),
      charged_total: Number(counts.charged_total),
      ledger_entries: ledgerRes.rows.length,
    },
    calendar,
    orders: ordersRes.rows.map((o) => ({
      ...o,
      order_date: String(o.order_date).slice(0, 10),
    })),
    ledger: ledgerRes.rows.map((l) => ({
      ...l,
      order_date: l.order_date ? String(l.order_date).slice(0, 10) : null,
    })),
  };
}
