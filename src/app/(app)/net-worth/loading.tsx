import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <Skeleton className="h-7 w-32" />
      <div className="rounded-xl border border-zinc-200 p-4 sm:p-6 dark:border-zinc-800">
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
