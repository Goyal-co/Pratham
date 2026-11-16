"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/http";
import { studentHref, useStudentBase } from "@/lib/student-paths";
import { deliveryLine, initialsOf } from "@/lib/student-ui";

type User = {
  full_name: string | null;
  email: string;
  phone: string | null;
  hostel: string | null;
  room: string | null;
  referral_code: string;
};

function RowIcon({ children }: { children: React.ReactNode }) {
  return <span className="ico">{children}</span>;
}

export default function StudentProfilePage() {
  const router = useRouter();
  const base = useStudentBase();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    api<{ user: User }>("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" });
    router.push(studentHref(base, "/login"));
    router.refresh();
  }

  const name = user?.full_name || "Student";

  return (
    <div>
      <h1 className="v2-page-title">My Profile</h1>

      <div className="v2-profile-card">
        <span className="v2-avatar">{initialsOf(name)}</span>
        <div>
          <strong>{name}</strong>
          <span>{user?.phone || user?.email || "—"}</span>
          <span>{deliveryLine(user?.hostel, user?.room)}</span>
        </div>
        <Link href={studentHref(base, "/profile")} className="edit">
          Edit
        </Link>
      </div>

      <div className="v2-list">
        <Link href={studentHref(base, "/plans")}>
          <RowIcon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 3.5v3.5M16 3.5v3.5M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </RowIcon>
          My Meal Plan
          <span className="chev">›</span>
        </Link>
        <Link href={studentHref(base, "/orders")}>
          <RowIcon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 7h12l1 3H5l1-3zM6 10h12l-1 10H7L6 10z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </RowIcon>
          My Orders
          <span className="chev">›</span>
        </Link>
        <Link href={studentHref(base, "/wallet")}>
          <RowIcon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </RowIcon>
          Wallet & Payments
          <span className="chev">›</span>
        </Link>
        <Link href={studentHref(base, "/profile")}>
          <RowIcon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 21s7-4.5 7-10a7 7 0 1 0-14 0c0 5.5 7 10 7 10z" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="11" r="2.2" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </RowIcon>
          Delivery Address
          <span className="chev">›</span>
        </Link>
        <Link href={studentHref(base, "/notifications")}>
          <RowIcon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </RowIcon>
          Notifications
          <span className="chev">›</span>
        </Link>
        <Link href={studentHref(base, "/profile#refer")}>
          <RowIcon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M3 19c1.5-3 3.5-4 6-4s4.5 1 6 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </RowIcon>
          Refer & Earn
          <span className="chev">›</span>
        </Link>
      </div>

      {user?.referral_code && (
        <section id="refer" className="student-panel">
          <div className="student-panel-head">
            <h2>Invite friends to AHARIVA</h2>
          </div>
          <div className="student-panel-body">
            <p className="student-panel-note">Your referral code</p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                background: "var(--s-accent-soft)",
                borderRadius: 12,
                padding: "12px 14px",
                fontWeight: 800,
                letterSpacing: "0.04em",
              }}
            >
              <span>{user.referral_code}</span>
              <button
                type="button"
                className="v2-link"
                onClick={() =>
                  navigator.clipboard?.writeText(user.referral_code)
                }
              >
                Copy
              </button>
            </div>
          </div>
        </section>
      )}

      <button type="button" className="v2-logout" onClick={signOut}>
        Log Out
      </button>
      <p className="v2-foot">AHARIVA v2.0 · Made for everyday student life</p>
    </div>
  );
}
