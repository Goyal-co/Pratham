import Link from "next/link";
import { query } from "@pratham/db";
import { creditAvailable, formatInr } from "@pratham/shared";
import { StudentActions } from "./StudentActions";
import { StudentsSearch } from "./StudentsSearch";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const params: unknown[] = [];
  let where = `u.role = 'student'`;
  if (q) {
    params.push(`%${q}%`);
    where += ` and (u.full_name ilike $1 or u.phone ilike $1 or u.email ilike $1)`;
  }

  const { rows: students } = await query(
    `select u.id, u.full_name, u.phone, u.hostel, u.room, u.referral_code,
            sa.credit_limit, sa.wallet_credit,
            coalesce(
              (select string_agg(fp.meal_type::text, ', ')
               from fixed_plans fp where fp.student_id = u.id and fp.is_active),
              ''
            ) as plans
     from users u
     left join student_accounts sa on sa.student_id = u.id
     where ${where}
     order by u.created_at desc`,
    params
  );

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Students</h1>
      <p className="muted">
        Wallet is the balance (can be negative). Credit limit = max borrow.
      </p>
      <StudentsSearch q={q} />
      <div className="card" style={{ marginTop: 12 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Wallet</th>
                <th>Credit limit</th>
                <th>Available</th>
                <th>Plans</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const wallet = Number(s.wallet_credit ?? 0);
                const limit = Number(s.credit_limit ?? 0);
                const available = creditAvailable(wallet, limit);
                const blocked = available <= 0;
                return (
                  <tr key={s.id}>
                    <td>
                      <div>
                        <Link
                          href={`/students/${s.id}`}
                          style={{ fontWeight: 700 }}
                        >
                          {s.full_name}
                        </Link>
                      </div>
                      <div className="muted">
                        {s.phone} · {s.hostel} {s.room}
                      </div>
                      <div className="muted">Code: {s.referral_code}</div>
                      {blocked ? (
                        <span className="badge" style={{ marginTop: 4 }}>
                          Credit full
                        </span>
                      ) : null}
                    </td>
                    <td>{formatInr(wallet)}</td>
                    <td>{formatInr(limit)}</td>
                    <td>{formatInr(available)}</td>
                    <td style={{ textTransform: "capitalize" }}>
                      {s.plans || "—"}
                    </td>
                    <td>
                      <StudentActions
                        studentId={s.id}
                        creditLimit={limit}
                        wallet={wallet}
                      />
                    </td>
                  </tr>
                );
              })}
              {!students.length && (
                <tr>
                  <td colSpan={6} className="muted">
                    No students found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
