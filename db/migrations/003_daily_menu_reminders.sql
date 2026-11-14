-- Daily / next-day menu + reminder tracking

alter table menu_items
  add column if not exists menu_date date;

comment on column menu_items.menu_date is
  'NULL = catalog/default item. Set to a date for that day''s special menu.';

create index if not exists menu_items_date_idx
  on menu_items (menu_date, meal_type)
  where is_active;

alter table app_settings
  add column if not exists reminder_lead_minutes int not null default 30
    check (reminder_lead_minutes >= 5 and reminder_lead_minutes <= 180);

-- Publish state per calendar day (for notify-once)
create table if not exists menu_day_pubs (
  menu_date date primary key,
  published_at timestamptz not null default now(),
  published_by uuid references users (id) on delete set null,
  notify_sent_at timestamptz
);

-- Dedup open/close/menu reminders (meal_key '' when not meal-scoped)
create table if not exists reminder_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  ref_date date not null,
  meal_key text not null default '',
  sent_at timestamptz not null default now(),
  unique (kind, ref_date, meal_key)
);
