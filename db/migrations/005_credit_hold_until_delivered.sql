-- Credits stay on hold for open orders; outstanding is owed only after delivery.
-- Rebalance existing accounts: remove open-order payables from outstanding.

update student_accounts sa
set outstanding_balance = greatest(
  0,
  outstanding_balance - coalesce(
    (
      select sum(o.payable_amount)
      from orders o
      where o.student_id = sa.student_id
        and o.status in ('placed', 'preparing', 'out_for_delivery')
    ),
    0
  )
),
updated_at = now();

comment on column student_accounts.outstanding_balance is
  'COD owed after delivery (cash to collect). Open orders hold credit separately until delivered.';
