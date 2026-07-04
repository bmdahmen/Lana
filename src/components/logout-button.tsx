"use client";

import { useRouter } from "next/navigation";

const DEFAULT_CLASS =
  "rounded-xl border border-zinc-200 px-4 py-3 text-left text-sm font-medium text-red-600 dark:border-zinc-800";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button onClick={logout} className={className ?? DEFAULT_CLASS}>
      Sign out
    </button>
  );
}
