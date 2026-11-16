-- Hot-path indexes for student queries
create index if not exists plan_cancellations_student_date_idx
  on plan_cancellations (student_id, cancel_date);

create index if not exists ledger_entries_student_created_idx
  on ledger_entries (student_id, created_at desc);

-- Reusable admin media gallery for menu images
create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  filename text not null,
  content_type text,
  byte_size integer,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists media_assets_created_at_idx
  on media_assets (created_at desc);
