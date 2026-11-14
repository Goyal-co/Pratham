create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on audit_logs (created_at desc);
create index if not exists audit_logs_entity_idx on audit_logs (entity, entity_id);
