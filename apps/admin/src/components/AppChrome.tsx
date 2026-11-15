"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/http";
import { AdminPwa } from "@/components/AdminPwa";
import { RotatingBrandInline } from "@/components/RotatingBrand";

const links = [
  { href: "/", label: "Dashboard", short: "Home" },
  { href: "/orders", label: "Orders", short: "Orders" },
  { href: "/kitchen", label: "Kitchen", short: "Kitchen" },
  { href: "/students", label: "Students", short: "Students" },
  { href: "/menu", label: "Menu", short: "Menu" },
  { href: "/referrals", label: "Referrals", short: "Invite" },
  { href: "/settings", label: "Settings", short: "Settings" },
];

const mobilePrimary = ["/", "/orders", "/kitchen", "/menu", "/settings"];

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className={`shell ${open ? "nav-open" : ""}`}>
      {open ? (
        <button
          className="nav-scrim"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand-row">
          <div className="brand">
            <RotatingBrandInline />
            <span>Admin · meals · COD</span>
          </div>
          <button
            className="icon-button close-nav"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            ✕
          </button>
        </div>
        <nav className="nav">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={pathname === l.href ? "active" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <button className="btn secondary signout" onClick={signOut}>
          Sign out
        </button>
      </aside>

      <div className="content-shell">
        <header className="topbar">
          <button
            className="menu-trigger"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <div className="topbar-title">
            {links.find((l) => l.href === pathname)?.label || "Kitchen"}
          </div>
          <span className="date-chip">
            {new Date().toLocaleDateString("en-IN", {
              timeZone: "Asia/Kolkata",
              day: "numeric",
              month: "short",
            })}
          </span>
        </header>
        <div className="main">
          <AdminPwa />
          {children}
        </div>
      </div>

      <nav className="mobile-bottom" aria-label="Primary">
        {links
          .filter((l) => mobilePrimary.includes(l.href))
          .map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={pathname === l.href ? "active" : undefined}
            >
              <span>{l.short}</span>
            </Link>
          ))}
      </nav>
    </div>
  );
}
