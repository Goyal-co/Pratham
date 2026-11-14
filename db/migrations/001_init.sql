-- Pratham Tiffin — plain PostgreSQL (no Supabase)

create extension if not exists "pgcrypto";

do $$ begin
  create type user_role as enum ('student', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type meal_type as enum ('breakfast', 'lunch', 'dinner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum (
    'placed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_source as enum ('adhoc', 'fixed_plan');
exception when duplicate_object then null; end $$;

do $$ begin
  create type referral_status as enum ('pending', 'earned', 'ineligible');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ledger_type as enum (
    'order_charge', 'wallet_applied', 'cod_collection', 'referral_credit', 'adjustment'
  );
exception when duplicate_object then null; end $$;

create or replace function generate_referral_code()
returns text language plpgsql as $$
declare code text;
begin
  loop
    code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
    exit when not exists (select 1 from users where referral_code = code);
  end loop;
  return code;
end;
$$;

create or replace function ist_today()
returns date language sql stable as $$
  select (timezone('Asia/Kolkata', now()))::date;
$$;

create or replace function ist_minutes_now()
returns int language sql stable as $$
  select extract(hour from timezone('Asia/Kolkata', now()))::int * 60
       + extract(minute from timezone('Asia/Kolkata', now()))::int;
$$;

create or replace function hhmm_to_minutes(t text)
returns int language sql immutable as $$
  select split_part(t, ':', 1)::int * 60 + split_part(t, ':', 2)::int;
$$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role user_role not null default 'student',
  full_name text,
  phone text,
  hostel text,
  room text,
  referral_code text not null unique default encode(gen_random_bytes(4), 'hex'),
  created_at timestamptz not null default now()
);

create table if not exists student_accounts (
  student_id uuid primary key references users (id) on delete cascade,
  credit_limit numeric(12,2) not null default 500 check (credit_limit >= 0),
  outstanding_balance numeric(12,2) not null default 0 check (outstanding_balance >= 0),
  wallet_credit numeric(12,2) not null default 0 check (wallet_credit >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists app_settings (
  id int primary key default 1 check (id = 1),
  breakfast_cutoff text not null default '06:00',
  lunch_cutoff text not null default '11:00',
  dinner_cutoff text not null default '17:00',
  referral_min_completed_orders int not null default 5 check (referral_min_completed_orders >= 1),
  referral_reward_credits numeric(12,2) not null default 100 check (referral_reward_credits >= 0),
  default_credit_limit numeric(12,2) not null default 500 check (default_credit_limit >= 0),
  timezone text not null default 'Asia/Kolkata',
  updated_at timestamptz not null default now()
);

insert into app_settings (id) values (1) on conflict (id) do nothing;

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  meal_type meal_type not null,
  name text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  is_active boolean not null default true,
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references users (id) on delete cascade,
  meal_type meal_type not null,
  menu_item_id uuid references menu_items (id) on delete set null,
  quantity int not null check (quantity >= 1 and quantity <= 10),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  wallet_applied numeric(12,2) not null default 0 check (wallet_applied >= 0),
  payable_amount numeric(12,2) not null check (payable_amount >= 0),
  status order_status not null default 'placed',
  source order_source not null default 'adhoc',
  order_date date not null default (timezone('Asia/Kolkata', now()))::date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_student_date_idx on orders (student_id, order_date);
create index if not exists orders_date_meal_idx on orders (order_date, meal_type);

create table if not exists fixed_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references users (id) on delete cascade,
  meal_type meal_type not null,
  menu_item_id uuid references menu_items (id) on delete set null,
  is_active boolean not null default true,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create unique index if not exists fixed_plans_one_active_per_meal
  on fixed_plans (student_id, meal_type) where is_active;

create table if not exists plan_cancellations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references users (id) on delete cascade,
  meal_type meal_type not null,
  cancel_date date not null,
  created_at timestamptz not null default now(),
  unique (student_id, meal_type, cancel_date)
);

create table if not exists ledger_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references users (id) on delete cascade,
  entry_type ledger_type not null,
  amount numeric(12,2) not null,
  order_id uuid references orders (id) on delete set null,
  note text,
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references users (id) on delete cascade,
  invitee_id uuid not null unique references users (id) on delete cascade,
  status referral_status not null default 'pending',
  completed_orders int not null default 0,
  earned_at timestamptz,
  created_at timestamptz not null default now(),
  check (inviter_id <> invitee_id)
);

create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token text not null,
  platform text,
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  title text not null,
  body text not null,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

insert into menu_items (meal_type, name, description, price)
select * from (values
  ('breakfast'::meal_type, 'Idli Sambar', 'Soft idlis with sambar & chutney', 40::numeric),
  ('breakfast'::meal_type, 'Poha', 'Classic poha with peanuts', 35::numeric),
  ('lunch'::meal_type, 'Veg Thali', 'Roti, rice, dal, sabzi, salad', 80::numeric),
  ('lunch'::meal_type, 'Rice Bowl', 'Jeera rice with dal fry', 70::numeric),
  ('dinner'::meal_type, 'Dinner Thali', 'Roti, rice, dal, seasonal sabzi', 85::numeric),
  ('dinner'::meal_type, 'Khichdi', 'Comfort khichdi with kadhi', 65::numeric)
) as v(meal_type, name, description, price)
where not exists (select 1 from menu_items limit 1);
