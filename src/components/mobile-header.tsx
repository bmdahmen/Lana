"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { SyncButton } from "@/components/sync-button";

/** Shows the Lana mark above every page on mobile (desktop already has it in
 *  SideNav). Home also gets a shortcut to add an account, since that header
 *  row used to live inline on the Home page itself. */
export function MobileHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className="flex items-center justify-between px-4 pt-6 pb-2 sm:px-8 md:hidden">
      <Logo iconSize={24} />
      <div className="flex items-center gap-2">
        <SyncButton />
        {isHome && (
          <Link
            href="/accounts"
            aria-label="Add account"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
          >
            +
          </Link>
        )}
      </div>
    </header>
  );
}
