import { BottomNav, SideNav } from "@/components/nav";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { MobileHeader } from "@/components/mobile-header";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const isGuest = session.role === "guest";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 md:flex-row dark:bg-black">
      <SideNav />
      <main className="flex-1 overflow-x-hidden pb-20 md:pb-8">
        <PullToRefresh>
          {isGuest && (
            <p className="bg-amber-500/10 px-4 py-1.5 text-center text-xs font-medium text-amber-600 dark:text-amber-400">
              Guest view — read only
            </p>
          )}
          <MobileHeader />
          {children}
        </PullToRefresh>
      </main>
      <BottomNav />
    </div>
  );
}
