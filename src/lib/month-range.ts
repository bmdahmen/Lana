export interface MonthOption {
  from: string;
  to: string;
  label: string;
}

function toISODate(year: number, month: number, day: number): string {
  return new Date(year, month, day).toISOString().slice(0, 10);
}

/** Builds `count` calendar-month ranges ending with the current month, most recent first. */
export function buildMonthOptions(count: number): MonthOption[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const year = now.getFullYear();
    const month = now.getMonth() - i;
    const start = new Date(year, month, 1);
    return {
      from: toISODate(start.getFullYear(), start.getMonth(), 1),
      to: toISODate(start.getFullYear(), start.getMonth() + 1, 0),
      label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    };
  });
}
