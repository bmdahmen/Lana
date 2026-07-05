import { getDB } from "@/lib/db";
import { InvestmentsBreakdown } from "@/components/investments-breakdown";
import { getInvestmentBreakdown } from "@/lib/investment-transactions";

function monthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export default async function InvestmentsPage() {
  const db = await getDB();
  const breakdown = await getInvestmentBreakdown(db, { from: monthStart() });

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Investments</h1>
      <InvestmentsBreakdown initialBreakdown={breakdown} />
    </div>
  );
}
