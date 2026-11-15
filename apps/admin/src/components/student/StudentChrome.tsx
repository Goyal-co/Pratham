"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EnablePush } from "./EnablePush";
import { InstallHint } from "./InstallHint";
import { studentHref, useStudentBase } from "@/lib/student-paths";

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
      match: (p: string) => p === "/app" || p === "/",
    },
    {
      href: studentHref(base, "/orders"),
      label: "Orders",
      match: (p: string) => p.includes("/orders"),
    },
    {
      href: studentHref(base, "/plans"),
      label: "Plans",
      match: (p: string) => p.includes("/plans"),
    },
    {
      href: studentHref(base, "/wallet"),
      label: "Wallet",
      match: (p: string) => p.includes("/wallet"),
    },
    {
      href: studentHref(base, "/profile"),
      label: "Me",
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
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
