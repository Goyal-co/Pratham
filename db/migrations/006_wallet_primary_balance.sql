-- Single balance model:
--   wallet_credit = main balance (can be negative = borrowed)
--   credit_limit  = max borrow (wallet cannot go below -credit_limit)
-- Fold old outstanding into wallet, then charge open holds that were not yet outstanding.

alter table student_accounts
  drop constraint if exists student_accounts_wallet_credit_check;

alter table student_accounts
  drop constraint if exists student_accounts_wallet_credit_check1;

-- Merge delivered debt into wallet (negative).
update student_accounts
set wallet_credit = wallet_credit - outstanding_balance,
    outstanding_balance = 0,
    updated_at = now();

-- Open orders were only on hold; charge their payable into wallet once.
update student_accounts sa
set wallet_credit = wallet_credit - coalesce(
  (
    select sum(o.payable_amount)
    from orders o
    where o.student_id = sa.student_id
      and o.status in ('placed', 'preparing', 'out_for_delivery')
  ),
  0
),
updated_at = now();

comment on column student_accounts.wallet_credit is
  'Main balance. Positive = prepaid; negative = borrowed. Floor is -credit_limit.';

comment on column student_accounts.credit_limit is
  'Maximum amount student may borrow (how negative wallet may go).';

comment on column student_accounts.outstanding_balance is
  'Deprecated. Kept for compatibility; always 0. Use wallet_credit instead.';
