import { query } from "@pratham/db";

export default async function ReferralsPage() {
  const { rows: settingsRows } = await query(
    `select referral_min_completed_orders, referral_reward_credits from app_settings where id = 1`
  );
  const settings = settingsRows[0];
  const { rows: referrals } = await query(
    `select r.*,
            inv.full_name as inviter_name, inv.referral_code as inviter_code,
            invee.full_name as invitee_name
     from referrals r
     join users inv on inv.id = r.inviter_id
     join users invee on invee.id = r.invitee_id
     order by r.created_at desc`
  );

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Referrals</h1>
      <p className="muted">
        Reward: ₹{settings?.referral_reward_credits ?? "—"} after invitee completes{" "}
        {settings?.referral_min_completed_orders ?? "—"} delivered orders (editable in
        Settings).
      </p>
      <div className="card">
        <div className="table-wrap"><table className="table">
          <thead>
            <tr>
              <th>Inviter</th>
              <th>Invitee</th>
              <th>Progress</th>
              <th>Status</th>
              <th>Earned</th>
            </tr>
          </thead>
          <tbody>
            {referrals.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.inviter_name}
                  <div className="muted">{r.inviter_code}</div>
                </td>
                <td>{r.invitee_name}</td>
                <td>
                  {r.completed_orders}/{settings?.referral_min_completed_orders}
                </td>
                <td>
                  <span className="badge">{r.status}</span>
                </td>
                <td>
                  {r.earned_at
                    ? new Date(r.earned_at).toLocaleString("en-IN")
                    : "—"}
                </td>
              </tr>
            ))}
            {!referrals.length && (
              <tr>
                <td colSpan={5} className="muted">
                  No referrals yet.
                </td>
              </tr>
            )}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
