export type Owner = "brian" | "emily";

export const OWNERS: { id: Owner; label: string; colorVar: string }[] = [
  { id: "brian", label: "Brian", colorVar: "--owner-brian" },
  { id: "emily", label: "Emily", colorVar: "--owner-emily" },
];

export function ownerLabel(owner: Owner): string {
  return OWNERS.find((o) => o.id === owner)?.label ?? owner;
}
