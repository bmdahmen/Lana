import { BottomNav, SideNav } from "@/components/nav";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 md:flex-row dark:bg-black">
      <SideNav />
      <main className="flex-1 overflow-x-hidden pb-20 md:pb-8">{children}</main>
      <BottomNav />
    </div>
  );
}
