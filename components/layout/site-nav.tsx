"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const routes = [
  { href: "/surfaces", label: "면 만들기" },
  { href: "/furniture", label: "가구 만들기" },
  { href: "/room", label: "방 구성" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="flex flex-col gap-4 rounded-[24px] border border-[var(--panel-border)] bg-[var(--panel-bg)] px-5 py-4 shadow-panel md:flex-row md:items-center md:justify-between">
      <div>
        <p className="font-display text-xl font-semibold tracking-tight text-ink-900">
          원룸 플래너
        </p>
        <p className="text-sm text-[var(--text-muted)]">
          이사 전에 방 구조와 배치를 미리 쉽고 가볍게 계획해 보세요.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {routes.map((route) => {
          const active = pathname === route.href;

          return (
            <Link
              key={route.href}
              href={route.href}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                active
                  ? "bg-ink-900 text-white shadow-lg shadow-ink-900/15"
                  : "border border-[var(--panel-border)] bg-white/70 text-ink-700 hover:border-ink-300 hover:bg-white"
              }`}
            >
              {route.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
