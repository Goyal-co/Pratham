"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

type EditMode = null | "profile" | "address";

function RowIcon({ children }: { children: React.ReactNode }) {
  return <span className="ico">{children}</span>;
}

export default function StudentProfilePage() {
  const router = useRouter();
  const base = useStudentBase();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [edit, setEdit] = useState<EditMode>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    hostel: "",
    room: "",
  });
  const addressRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ user: User }>("/api/auth/me")
      .then((d) => {
        if (cancelled) return;
        setUser(d.user);
        setForm({
          full_name: d.user.full_name || "",
          phone: d.user.phone || "",
          hostel: d.user.hostel || "",
          room: d.user.room || "",
        });
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" });
    router.push(studentHref(base, "/login"));
    router.refresh();
  }

  function openEdit(mode: EditMode) {
    const src = user || {
      full_name: form.full_name,
      phone: form.phone,
      hostel: form.hostel,
      room: form.room,
      email: "",
      referral_code: "",
    };
    setForm({
      full_name: src.full_name || "",
      phone: src.phone || "",
      hostel: src.hostel || "",
      room: src.room || "",
    });
    setMsg(null);
    setEdit(mode);
    if (mode === "address") {
      requestAnimationFrame(() =>
        addressRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    }
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const payload =
        edit === "address"
          ? { hostel: form.hostel.trim(), room: form.room.trim() }
          : {
              full_name: form.full_name.trim(),
              phone: form.phone.trim(),
              hostel: form.hostel.trim(),
              room: form.room.trim(),
            };
      const data = await api<{ user: User }>("/api/auth/me", {
        method: "PATCH",
        json: payload,
      });
      setUser(data.user);
      setForm({
        full_name: data.user.full_name || "",
        phone: data.user.phone || "",
        hostel: data.user.hostel || "",
        room: data.user.room || "",
      });
      setEdit(null);
      setMsg(edit === "address" ? "Delivery address updated" : "Profile updated");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const name = user?.full_name || "Student";

  return (
    <div>
      <h1 className="v2-page-title">My Profile</h1>
      {msg && <div className="student-banner info">{msg}</div>}

      <div className="v2-profile-card">
        <span className="v2-avatar" aria-hidden>
          {initialsOf(name)}
        </span>
        <div className="v2-profile-meta">
          <strong>{name}</strong>
          <span>{user?.phone || user?.email || "—"}</span>
          <span>{deliveryLine(user?.hostel, user?.room)}</span>
        </div>
        <button
          type="button"
          className="edit"
          disabled={!ready}
          onClick={() => openEdit("profile")}
        >
          Edit
        </button>
      </div>

      {edit === "profile" && (
        <section className="student-panel">
          <div className="student-panel-head">
            <h2>Edit profile</h2>
          </div>
          <form className="student-panel-body" onSubmit={saveProfile}>
            <label className="student-field">
              Full name
              <input
                value={form.full_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, full_name: e.target.value }))
                }
                required
              />
            </label>
            <label className="student-field">
              Phone
              <input
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                inputMode="tel"
              />
            </label>
            <label className="student-field">
              Hostel / PG
              <input
                value={form.hostel}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hostel: e.target.value }))
                }
              />
            </label>
            <label className="student-field">
              Room
              <input
                value={form.room}
                onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
              />
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="student-btn" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                className="student-btn secondary"
                type="button"
                disabled={busy}
                onClick={() => setEdit(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="v2-list">
        <Link href={studentHref(base, "/plans")}>
          <RowIcon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect
                x="4"
                y="5"
                width="16"
                height="15"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="M8 3.5v3.5M16 3.5v3.5M4 10h16"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </RowIcon>
          My Meal Plan
          <span className="chev">›</span>
        </Link>
        <Link href={studentHref(base, "/orders")}>
          <RowIcon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 7h12l1 3H5l1-3zM6 10h12l-1 10H7L6 10z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </RowIcon>
          My Orders
          <span className="chev">›</span>
        </Link>
        <Link href={studentHref(base, "/wallet")}>
          <RowIcon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect
                x="3"
                y="6"
                width="18"
                height="13"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </RowIcon>
          Wallet & Payments
          <span className="chev">›</span>
        </Link>
        <button type="button" onClick={() => openEdit("address")}>
          <RowIcon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 21s7-4.5 7-10a7 7 0 1 0-14 0c0 5.5 7 10 7 10z"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle
                cx="12"
                cy="11"
                r="2.2"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          </RowIcon>
          Delivery Address
          <span className="chev">›</span>
        </button>
        <Link href={studentHref(base, "/notifications")}>
          <RowIcon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M10 19a2 2 0 0 0 4 0"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          </RowIcon>
          Notifications
          <span className="chev">›</span>
        </Link>
        <Link href={studentHref(base, "/refer")}>
          <RowIcon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle
                cx="9"
                cy="8"
                r="3"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle
                cx="17"
                cy="9"
                r="2.5"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="M3 19c1.5-3 3.5-4 6-4s4.5 1 6 4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </RowIcon>
          Refer & Earn
          <span className="chev">›</span>
        </Link>
      </div>

      {edit === "address" && (
        <section ref={addressRef} className="student-panel">
          <div className="student-panel-head">
            <h2>Delivery address</h2>
          </div>
          <form className="student-panel-body" onSubmit={saveProfile}>
            <label className="student-field">
              Hostel / PG
              <input
                value={form.hostel}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hostel: e.target.value }))
                }
                required
                placeholder="e.g. Sood PG"
              />
            </label>
            <label className="student-field">
              Room
              <input
                value={form.room}
                onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
                required
                placeholder="e.g. 12"
              />
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="student-btn" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save address"}
              </button>
              <button
                className="student-btn secondary"
                type="button"
                disabled={busy}
                onClick={() => setEdit(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <button type="button" className="v2-logout" onClick={signOut}>
        Log Out
      </button>
      <p className="v2-foot">AHARIVA v2.0 · Made for everyday student life</p>
    </div>
  );
}
