import { OWNERS, type Owner } from "@/lib/owners";

export function OwnerBadge({ owner }: { owner: Owner }) {
  const o = OWNERS.find((o) => o.id === owner);
  if (!o) return null;
  return (
    <span
      title={o.label}
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
      style={{ backgroundColor: `var(${o.colorVar})` }}
    >
      {o.label[0]}
    </span>
  );
}
