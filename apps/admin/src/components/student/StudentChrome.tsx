"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EnablePush } from "./EnablePush";
import { InstallHint } from "./InstallHint";

const tabs = [
  { href: "/app", label: "Home", match: (p: string) => p === "/app" },
  {
    href: "/app/orders",
    label: "Orders",
    match: (p: string) => p.startsWith("/app/orders"),
  },
  {
    href: "/app/plans",
    label: "Plans",
    match: (p: string) => p.startsWith("/app/plans"),
  },
  {
    href: "/app/wallet",
    label: "Wallet",
    match: (p: string) => p.startsWith("/app/wallet"),
  },
  {
    href: "/app/profile",
    label: "Me",
    match: (p: string) => p.startsWith("/app/profile") || p.startsWith("/app/notifications"),
  },
];

export function StudentChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const auth =
    pathname === "/app/login" || pathname === "/app/signup";

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
