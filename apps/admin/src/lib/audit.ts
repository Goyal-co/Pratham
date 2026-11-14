import { query } from "@pratham/db";

export async function writeAudit(input: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  note?: string | null;
}) {
  await query(
    `insert into audit_logs (actor_id, action, entity, entity_id, before, after, note)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [
      input.actorId ?? null,
      input.action,
      input.entity,
      input.entityId ?? null,
      input.before ? JSON.stringify(input.before) : null,
      input.after ? JSON.stringify(input.after) : null,
      input.note ?? null,
    ]
  );
}
