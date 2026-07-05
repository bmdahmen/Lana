import { getDB } from "@/lib/db";
import { getCached, CACHE_KEYS } from "@/lib/cache";
import { formatCurrency, formatDate } from "@/lib/format";
import { ASSET_CLASSES, type AssetClass, type PreciousMetal, type Cryptocurrency } from "@/lib/asset-classes";
import { AddManualAccountButton } from "@/components/add-manual-account-button";
import { AccountRowActions } from "@/components/account-row-actions";
import { AccountCategorySelect } from "@/components/account-category-select";
import { LinkAccountButton } from "@/components/link-account-button";
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
  crypto_symbol: Cryptocurrency | null;
  crypto_amount: number | null;
  relevant_from: string | null;
  relevant_until: string | null;
  property_address: string | null;
}

interface AccountGroup {
  key: string;
  label: string;
  icon: string;
  accounts: AccountRow[];
}

function groupAccounts(accounts: AccountRow[]): AccountGroup[] {
  const current = accounts.filter((a) => !a.relevant_until);
  const historical = accounts.filter((a) => a.relevant_until);

  const groups: AccountGroup[] = [];
  for (const cls of ASSET_CLASSES) {
    const inClass = current.filter((a) => a.asset_class === cls.id);
    if (inClass.length > 0) {
      groups.push({ key: cls.id, label: cls.label, icon: cls.icon, accounts: inClass });
    }
  }
  if (historical.length > 0) {
    groups.push({ key: "historical", label: "Historical", icon: "🕰️", accounts: historical });
  }
  return groups;
}

export default async function AccountsPage() {
  const db = await getDB();
  const accounts = await getCached(CACHE_KEYS.accountsList, async () => {
    const result = await db
      .prepare(
        `SELECT a.id, a.name, a.official_name, a.mask, a.current_balance, a.is_manual, a.is_hidden,
                a.asset_class, p.institution_name, p.status as item_status,
                a.precious_metal, a.metal_troy_oz, a.crypto_symbol, a.crypto_amount,
                a.relevant_from, a.relevant_until, a.property_address
         FROM account a
         LEFT JOIN plaid_item p ON p.id = a.plaid_item_id
         WHERE a.is_closed = 0
         ORDER BY (a.relevant_until IS NOT NULL) ASC, a.is_hidden ASC, a.asset_class ASC, a.current_balance DESC`
      )
      .all<AccountRow>();
    return result.results ?? [];
  });

  const groups = groupAccounts(accounts);

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Accounts</h1>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <LinkAccountButton />
        <AddManualAccountButton />
        <ImportCsvButton accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} />
      </div>

      {accounts.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No accounts yet. Link a bank account above, or add one manually.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.key} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between px-0.5">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <span className="text-sm">{group.icon}</span>
                  {group.label}
                </h2>
                <span className="text-xs font-medium text-zinc-400 dark:text-zinc-600">
                  {formatCurrency(group.accounts.reduce((sum, a) => sum + (a.current_balance ?? 0), 0))}
                </span>
              </div>

              {/* Mobile: compact card list */}
              <ul className="flex flex-col gap-1.5 md:hidden">
                {group.accounts.map((acc) => (
                  <li
                    key={acc.id}
                    className={
                      "rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950" +
                      (acc.is_hidden ? " opacity-50" : "")
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {acc.name}
                          {acc.mask && <span className="text-zinc-400"> •••• {acc.mask}</span>}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-zinc-400 dark:text-zinc-600">
                          {accountSubline(acc)}
                        </p>
                      </div>
                      <p className="shrink-0 font-medium text-zinc-900 dark:text-zinc-50">
                        {formatCurrency(acc.current_balance ?? 0)}
                      </p>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                      <AccountCategorySelect accountId={acc.id} assetClass={acc.asset_class} />
                      <AccountRowActions
                        accountId={acc.id}
                        isHidden={!!acc.is_hidden}
                        isManual={!!acc.is_manual}
                        preciousMetal={acc.precious_metal}
                        cryptoSymbol={acc.crypto_symbol}
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
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                    {group.accounts.map((acc) => (
                      <tr key={acc.id} className={acc.is_hidden ? "opacity-50" : undefined}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-zinc-900 dark:text-zinc-50">
                            {acc.name}
                            {acc.mask && <span className="text-zinc-400"> •••• {acc.mask}</span>}
                          </p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-600">{accountSubline(acc)}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <AccountCategorySelect accountId={acc.id} assetClass={acc.asset_class} />
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-zinc-900 dark:text-zinc-50">
                          {formatCurrency(acc.current_balance ?? 0)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <AccountRowActions
                            accountId={acc.id}
                            isHidden={!!acc.is_hidden}
                            isManual={!!acc.is_manual}
                            preciousMetal={acc.precious_metal}
                            cryptoSymbol={acc.crypto_symbol}
                            isHistorical={!!acc.relevant_until}
                            propertyAddress={acc.property_address}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function accountSubline(acc: AccountRow): string {
  const parts: string[] = [];
  if (acc.precious_metal) parts.push(`${acc.metal_troy_oz} troy oz ${acc.precious_metal}`);
  if (acc.crypto_symbol) parts.push(`${acc.crypto_amount} ${acc.crypto_symbol.toUpperCase()}`);
  if (acc.property_address) parts.push(acc.property_address);
  if (acc.relevant_until) {
    parts.push(
      `${acc.relevant_from ? formatDate(acc.relevant_from) : "—"} – ${formatDate(acc.relevant_until)}`
    );
  }
  parts.push(acc.is_manual ? "Manual" : acc.institution_name ?? "—");
  if (acc.item_status === "login_required") parts.push("Needs attention");
  return parts.join(" · ");
}
