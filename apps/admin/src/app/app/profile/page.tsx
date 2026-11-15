"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/http";
import { studentHref, useStudentBase } from "@/lib/student-paths";

type User = {
  full_name: string | null;
  email: string;
  phone: string | null;
  hostel: string | null;
  room: string | null;
  referral_code: string;
};

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

  if (!user) {
    return (
      <div>
        <p className="student-kicker">Ahariva</p>
        <h1 className="student-title">Profile</h1>
        <div className="student-skeleton" style={{ height: 120 }} />
      </div>
    );
  }

  return (
    <div>
      <p className="student-kicker">Ahariva</p>
      <h1 className="student-title">Profile</h1>
      <p className="student-muted">Cash on delivery only</p>

      <div className="student-panel">
        <div className="student-panel-body">
          <div className="student-dish-name" style={{ fontSize: "1.2rem" }}>
            {user.full_name}
          </div>
          <div className="student-dish-desc">{user.email}</div>
          <div className="student-dish-desc">{user.phone}</div>
          <div className="student-dish-desc">
            {[user.hostel, user.room].filter(Boolean).join(" · ") || "—"}
          </div>
          <div style={{ marginTop: 14 }}>
            <span className="student-badge">Referral · {user.referral_code}</span>
          </div>
        </div>
      </div>

      <div className="student-card">
        <Link
          href={studentHref(base, "/notifications")}
          style={{ fontWeight: 750, color: "inherit" }}
        >
          Notifications →
        </Link>
      </div>

      <button className="student-btn secondary" type="button" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
