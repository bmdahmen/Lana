import { getDB } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import { type AssetClass, type PreciousMetal } from "@/lib/asset-classes";
import { recomputeMetalAccountBalances } from "@/lib/spot-price";
import { recomputeRealEstateAccountBalances } from "@/lib/zillow";
import { AddManualAccountButton } from "@/components/add-manual-account-button";
import { AccountRowActions } from "@/components/account-row-actions";
import { AccountCategorySelect } from "@/components/account-category-select";
import { LinkAccountButton } from "@/components/link-account-button";
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
  asset_class: AssetClass;
  institution_name: string | null;
  item_status: string | null;
  precious_metal: PreciousMetal | null;
  metal_troy_oz: number | null;
  relevant_from: string | null;
  relevant_until: string | null;
  property_address: string | null;
}

export default async function AccountsPage() {
  const db = await getDB();
  await recomputeMetalAccountBalances(db);
  await recomputeRealEstateAccountBalances(db);
  const result = await db
    .prepare(
      `SELECT a.id, a.name, a.official_name, a.mask, a.current_balance, a.is_manual, a.is_hidden,
              a.asset_class, p.institution_name, p.status as item_status,
              a.precious_metal, a.metal_troy_oz, a.relevant_from, a.relevant_until,
              a.property_address
       FROM account a
       LEFT JOIN plaid_item p ON p.id = a.plaid_item_id
       WHERE a.is_closed = 0
       ORDER BY a.is_hidden ASC, a.asset_class ASC, a.name ASC`
    )
    .all<AccountRow>();
  const accounts = result.results ?? [];

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Accounts</h1>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <LinkAccountButton />
        <LinkMxAccountButton />
        <AddManualAccountButton />
        <ImportCsvButton accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} />
      </div>

      {accounts.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No accounts yet. Link a bank account above, or add one manually.
        </p>
      ) : (
        <>
          {/* Mobile: card list */}
          <ul className="flex flex-col gap-3 md:hidden">
            {accounts.map((acc) => (
              <li
                key={acc.id}
                className={
                  "rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950" +
                  (acc.is_hidden ? " opacity-50" : "")
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                      {acc.name}
                    </p>
                    {acc.mask && <p className="mt-0.5 text-xs text-zinc-500">•••• {acc.mask}</p>}
                    <div className="mt-1">
                      <AccountCategorySelect accountId={acc.id} assetClass={acc.asset_class} />
                    </div>
                    {acc.precious_metal && (
                      <p className="mt-1 text-xs text-zinc-500">
                        {acc.metal_troy_oz} troy oz {acc.precious_metal}
                      </p>
                    )}
                    {acc.relevant_until && (
                      <p className="mt-0.5 inline-flex items-center rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-900">
                        Historical: {acc.relevant_from ? formatDate(acc.relevant_from) : "—"}
                        {" – "}
                        {formatDate(acc.relevant_until)}
                      </p>
                    )}
                    {acc.property_address && (
                      <p className="text-xs text-zinc-500">{acc.property_address}</p>
                    )}
                    <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-600">
                      {acc.is_manual ? "Manual" : acc.institution_name ?? "—"}
                      {acc.item_status === "login_required" && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                          Needs attention
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium text-zinc-900 dark:text-zinc-50">
                    {formatCurrency(acc.current_balance ?? 0)}
                  </p>
                </div>
                <div className="mt-3 border-t border-zinc-100 pt-2 dark:border-zinc-900">
                  <AccountRowActions
                    accountId={acc.id}
                    isHidden={!!acc.is_hidden}
                    isManual={!!acc.is_manual}
                    preciousMetal={acc.precious_metal}
                    isHistorical={!!acc.relevant_until}
                    propertyAddress={acc.property_address}
                  />
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-xl border border-zinc-200 bg-white md:block dark:border-zinc-800 dark:bg-zinc-950">
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
                      {acc.relevant_until && (
                        <p className="mt-0.5 inline-flex items-center rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-900">
                          Historical: {acc.relevant_from ? formatDate(acc.relevant_from) : "—"}
                          {" – "}
                          {formatDate(acc.relevant_until)}
                        </p>
                      )}
                      {acc.property_address && (
                        <p className="text-xs text-zinc-500">{acc.property_address}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <AccountCategorySelect accountId={acc.id} assetClass={acc.asset_class} />
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
                        isHistorical={!!acc.relevant_until}
                        propertyAddress={acc.property_address}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
