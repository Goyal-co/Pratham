"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EnablePush } from "./EnablePush";
import { InstallHint } from "./InstallHint";
import { studentHref, useStudentBase } from "@/lib/student-paths";

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
    </svg>
  );
}

function IconOrders() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4h10l1 4H6l1-4z" />
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 12h6" />
    </svg>
  );
}

function IconPlans() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconMe() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5c1.8-3.2 4.2-4.5 7-4.5s5.2 1.3 7 4.5" />
    </svg>
  );
}

export function StudentChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const base = useStudentBase();
  const auth =
    pathname === "/app/login" ||
    pathname === "/app/signup" ||
    pathname.startsWith("/app/login/") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/login/");

  const tabs = [
    {
      href: studentHref(base),
      label: "Home",
      icon: <IconHome />,
      match: (p: string) => p === "/app" || p === "/",
    },
    {
      href: studentHref(base, "/orders"),
      label: "Orders",
      icon: <IconOrders />,
      match: (p: string) => p.includes("/orders"),
    },
    {
      href: studentHref(base, "/plans"),
      label: "Plans",
      icon: <IconPlans />,
      match: (p: string) => p.includes("/plans"),
    },
    {
      href: studentHref(base, "/wallet"),
      label: "Wallet",
      icon: <IconWallet />,
      match: (p: string) => p.includes("/wallet"),
    },
    {
      href: studentHref(base, "/profile"),
      label: "Me",
      icon: <IconMe />,
      match: (p: string) =>
        p.includes("/profile") || p.includes("/notifications"),
    },
  ];

  if (auth) {
    return (
      <div className="student-shell auth">
        <div className="student-main" style={{ width: "100%" }}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="student-shell">
      <div className="student-main">
        <InstallHint />
        <EnablePush />
        {children}
      </div>
      <nav className="student-tabs" aria-label="Student">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={t.match(pathname) ? "active" : undefined}
          >
            {t.icon}
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
