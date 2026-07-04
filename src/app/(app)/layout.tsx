import { Nav } from "@/components/nav";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-black">
      <Nav />
      <main className="flex-1 overflow-x-hidden p-8">{children}</main>
    </div>
  );
}
