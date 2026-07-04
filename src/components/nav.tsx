"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/net-worth", label: "Net Worth" },
  { href: "/accounts", label: "Accounts" },
  { href: "/transactions", label: "Transactions" },
  { href: "/spending", label: "Spending" },
  { href: "/rules", label: "Rules" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="flex w-56 shrink-0 flex-col justify-between border-r border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <div className="mb-8 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Lana</div>
        <ul className="flex flex-col gap-1">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={clsx(
                  "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname === link.href
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <button
        onClick={logout}
        className="rounded-md px-3 py-2 text-left text-sm font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
      >
        Sign out
      </button>
    </nav>
  );
}
