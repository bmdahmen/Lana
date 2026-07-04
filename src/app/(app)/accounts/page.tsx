import { getDB } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { ASSET_CLASSES, type PreciousMetal } from "@/lib/asset-classes";
import { recomputeMetalAccountBalances } from "@/lib/spot-price";
import { AddManualAccountButton } from "@/components/add-manual-account-button";
import { AccountRowActions } from "@/components/account-row-actions";
import { LinkMxAccountButton } from "@/components/link-mx-account-button";
import { ImportCsvButton } from "@/components/import-csv-button";

interface AccountRow {
  id: string;
  name: string;
  official_name: string | null;
  mask: string | null;
  current_balance: number | null;
  is_manual: number;
  is_hidden: number;
  asset_class: string;
  institution_name: string | null;
  item_status: string | null;
  precious_metal: PreciousMetal | null;
  metal_troy_oz: number | null;
}

const CLASS_LABEL = new Map<string, string>(ASSET_CLASSES.map((c) => [c.id, c.label]));

export default async function AccountsPage() {
  const db = await getDB();
  await recomputeMetalAccountBalances(db);
  const result = await db
    .prepare(
      `SELECT a.id, a.name, a.official_name, a.mask, a.current_balance, a.is_manual, a.is_hidden,
              a.asset_class, p.institution_name, p.status as item_status,
              a.precious_metal, a.metal_troy_oz
       FROM account a
       LEFT JOIN plaid_item p ON p.id = a.plaid_item_id
       WHERE a.is_closed = 0
       ORDER BY a.is_hidden ASC, a.asset_class ASC, a.name ASC`
    )
    .all<AccountRow>();
  const accounts = result.results ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Accounts</h1>
        <div className="flex gap-2">
          <LinkMxAccountButton />
          <AddManualAccountButton />
          <ImportCsvButton accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} />
        </div>
      </div>

      {accounts.length === 0 ? (
        <p className="text-sm text-zinc-500">No accounts yet. Link a bank account from the dashboard, or add one manually.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Institution</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {accounts.map((acc) => (
                <tr key={acc.id} className={acc.is_hidden ? "opacity-50" : undefined}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{acc.name}</p>
                    {acc.mask && <p className="text-xs text-zinc-500">•••• {acc.mask}</p>}
                    {acc.precious_metal && (
                      <p className="text-xs text-zinc-500">
                        {acc.metal_troy_oz} troy oz {acc.precious_metal}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {CLASS_LABEL.get(acc.asset_class) ?? acc.asset_class}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {acc.is_manual ? "Manual" : acc.institution_name ?? "—"}
                    {acc.item_status === "login_required" && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                        Needs attention
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-900 dark:text-zinc-50">
                    {formatCurrency(acc.current_balance ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <AccountRowActions
                      accountId={acc.id}
                      isHidden={!!acc.is_hidden}
                      isManual={!!acc.is_manual}
                      preciousMetal={acc.precious_metal}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
