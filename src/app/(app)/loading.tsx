import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <section className="px-4 pt-4 pb-6 sm:px-8">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-2 h-10 w-40" />
        <Skeleton className="mt-4 h-52 w-full" />
      </section>

      <section className="px-4 pb-8 sm:px-8">
        <Skeleton className="mb-3 h-4 w-28" />
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-3.5 w-14" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
