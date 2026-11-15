"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/http";

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
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    api<{ user: User }>("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/app/login");
    router.refresh();
  }

  if (!user) {
    return (
      <div>
        <h1 className="student-title">Profile</h1>
        <p className="student-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="student-title">Profile</h1>
      <p className="student-muted">Cash on delivery only.</p>
      <div className="student-card">
        <div style={{ fontWeight: 800, fontSize: 18 }}>{user.full_name}</div>
        <div className="student-muted">{user.email}</div>
        <div className="student-muted">{user.phone}</div>
        <div className="student-muted">
          {user.hostel} {user.room}
        </div>
        <div style={{ fontWeight: 700, marginTop: 8 }}>
          Referral code: {user.referral_code}
        </div>
      </div>
      <div className="student-card">
        <Link href="/app/notifications" style={{ fontWeight: 700, color: "inherit" }}>
          Notifications →
        </Link>
      </div>
      <button className="student-btn secondary" type="button" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
