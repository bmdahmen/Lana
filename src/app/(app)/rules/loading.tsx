import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-3.5 w-full max-w-md" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
