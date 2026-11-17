"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AppSplash } from "./AppSplash";
import { InstallHint } from "./InstallHint";
import { studentHref, useStudentBase } from "@/lib/student-paths";

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 7h12l1 3H5l1-3z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M6 10h12l-1 10H7L6 10z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMeals() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="4"
        y="5"
        width="16"
        height="15"
        rx="2.5"
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
  );
}

function IconMe() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 19c1.7-3 4-4.3 7-4.3S17.3 16 19 19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StudentChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
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
      match: (p: string) => p === "/app" || p === "/" || p === "/app/",
    },
    {
      href: studentHref(base, "/menu"),
      label: "Menu",
      icon: <IconMenu />,
      match: (p: string) => p.includes("/menu"),
    },
    {
      href: studentHref(base, "/meals"),
      label: "My Meals",
      icon: <IconMeals />,
      match: (p: string) =>
        p.includes("/meals") || p.includes("/plans") || p.includes("/orders"),
    },
    {
      href: studentHref(base, "/profile"),
      label: "Profile",
      icon: <IconMe />,
      match: (p: string) =>
        p.includes("/profile") ||
        p.includes("/notifications") ||
        p.includes("/wallet") ||
        p.includes("/refer"),
    },
  ];

  /** Keep tab switches inside the installed PWA (no top-level browser handoff). */
  function onTabClick(
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    e.preventDefault();
    if (pathname !== href) router.push(href);
  }

  if (auth) {
    return (
      <div className="student-shell auth">
        <AppSplash />
        <div className="student-main" style={{ width: "100%" }}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="student-shell">
      <AppSplash />
      <div className="student-main">
        <InstallHint />
        {children}
      </div>
      <nav className="student-tabs" aria-label="Student">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={t.match(pathname) ? "active" : undefined}
            onClick={(e) => onTabClick(e, t.href)}
          >
            {t.icon}
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
