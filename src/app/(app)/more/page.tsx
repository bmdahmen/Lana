import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

const LINKS = [
  { href: "/net-worth", label: "Net Worth breakdown", description: "Full history by category" },
  { href: "/rules", label: "Categorization rules", description: "Auto-tag transactions" },
];

export default function MorePage() {
  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">More</h1>

      <ul className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        {LINKS.map((link, i) => (
          <li key={link.href} className={i > 0 ? "border-t border-zinc-100 dark:border-zinc-900" : undefined}>
            <Link href={link.href} className="flex items-center justify-between px-4 py-3.5">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{link.label}</p>
                <p className="text-xs text-zinc-500">{link.description}</p>
              </div>
              <span className="text-zinc-400">›</span>
            </Link>
          </li>
        ))}
      </ul>

      <LogoutButton />
    </div>
  );
}
