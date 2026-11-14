import { query } from "@pratham/db";

export default async function AuditPage() {
  const { rows } = await query(
    `select a.*, u.full_name as actor_name, u.email as actor_email
     from audit_logs a
     left join users u on u.id = a.actor_id
     order by a.created_at desc
     limit 100`
  );

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Audit log</h1>
      <p className="muted">Balance, credit limit, settings, and order status changes.</p>
      <div className="card">
        <div className="table-wrap"><table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toLocaleString("en-IN")}</td>
                <td>
                  <div>{r.actor_name || "—"}</div>
                  <div className="muted">{r.actor_email}</div>
                </td>
                <td>
                  <span className="badge">{r.action}</span>
                </td>
                <td>
                  {r.entity}
                  {r.entity_id ? (
                    <div className="muted" style={{ fontSize: 11 }}>
                      {String(r.entity_id).slice(0, 8)}…
                    </div>
                  ) : null}
                </td>
                <td>{r.note || "—"}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="muted">
                  No audit entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
