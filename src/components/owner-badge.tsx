import { OWNERS, type Owner } from "@/lib/owners";

export function OwnerBadge({
  owner,
  splitOffset,
}: {
  owner: Owner;
  /** When set, the account is jointly split 50/50 (plus/minus this dollar
   *  offset) between both owners rather than wholesale to `owner` -- see
   *  computeNetWorthSeries. Renders a two-tone badge instead of a single
   *  initial so split accounts are visually distinct at a glance. */
  splitOffset?: number | null;
}) {
  if (splitOffset != null) {
    const [a, b] = OWNERS;
    return (
      <span
        title={`Split 50/50 between ${a.label} and ${b.label}${splitOffset !== 0 ? ` ($${Math.abs(splitOffset).toLocaleString()} extra to ${splitOffset > 0 ? a.label : b.label})` : ""}`}
        className="inline-flex h-4 w-4 shrink-0 overflow-hidden rounded-full text-[9px] font-bold text-white"
      >
        <span className="flex flex-1 items-center justify-center" style={{ backgroundColor: `var(${a.colorVar})` }}>
          {a.label[0]}
        </span>
        <span className="flex flex-1 items-center justify-center" style={{ backgroundColor: `var(${b.colorVar})` }}>
          {b.label[0]}
        </span>
      </span>
    );
  }

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
