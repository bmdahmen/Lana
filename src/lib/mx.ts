const MX_ACCEPT_VERSION = "v20250224";

function getMxBaseUrl(): string {
  const env = process.env.MX_ENV ?? "sandbox";
  return env === "production" ? "https://api.mx.com" : "https://int-api.mx.com";
}

function getAuthHeader(): string {
  const clientId = process.env.MX_CLIENT_ID;
  const apiKey = process.env.MX_API_KEY;
  if (!clientId || !apiKey) {
    throw new Error("MX_CLIENT_ID and MX_API_KEY must be set");
  }
  return `Basic ${btoa(`${clientId}:${apiKey}`)}`;
}

async function mxRequest<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${getMxBaseUrl()}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      "Accept-Version": MX_ACCEPT_VERSION,
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MX API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export interface MxUser {
  guid: string;
  id: string;
  email: string | null;
}

export async function createMxUser(id: string): Promise<MxUser> {
  const data = await mxRequest<{ user: MxUser }>("/users", {
    method: "POST",
    body: { user: { id } },
  });
  return data.user;
}

export interface MxWidgetUrl {
  type: string;
  url: string;
  user_id: string;
}

export async function requestWidgetUrl(userGuid: string): Promise<MxWidgetUrl> {
  const data = await mxRequest<{ widget_url: MxWidgetUrl }>(
    `/users/${userGuid}/widget_urls`,
    {
      method: "POST",
      body: {
        widget_type: "connect_widget",
        mode: "aggregation",
        include_transactions: true,
      },
    }
  );
  return data.widget_url;
}

export interface MxMember {
  guid: string;
  id: string;
  name: string | null;
  institution_code: string | null;
  connection_status: string;
}

export async function getMember(userGuid: string, memberGuid: string): Promise<MxMember> {
  const data = await mxRequest<{ member: MxMember }>(
    `/users/${userGuid}/members/${memberGuid}`
  );
  return data.member;
}

export interface MxAccount {
  guid: string;
  id: string;
  member_guid: string;
  name: string;
  type: string;
  subtype: string | null;
  balance: number;
  available_balance: number | null;
  available_credit: number | null;
  currency_code: string | null;
}

export async function listMemberAccounts(userGuid: string, memberGuid: string): Promise<MxAccount[]> {
  const accounts: MxAccount[] = [];
  let page = 1;
  for (;;) {
    const data = await mxRequest<{
      accounts: MxAccount[];
      pagination: { total_pages: number };
    }>(`/users/${userGuid}/members/${memberGuid}/accounts?page=${page}&records_per_page=100`);
    accounts.push(...data.accounts);
    if (page >= data.pagination.total_pages) break;
    page++;
  }
  return accounts;
}

export interface MxTransaction {
  guid: string;
  id: string;
  account_guid: string;
  amount: number;
  currency_code: string | null;
  date: string;
  description: string;
  category: string | null;
  type: "CREDIT" | "DEBIT";
  status: string;
  is_income: boolean;
}

export async function listMemberTransactions(
  userGuid: string,
  memberGuid: string,
  fromDate?: Date
): Promise<MxTransaction[]> {
  const transactions: MxTransaction[] = [];
  let page = 1;
  const fromParam = fromDate ? `&from_date=${Math.floor(fromDate.getTime() / 1000)}` : "";
  for (;;) {
    const data = await mxRequest<{
      transactions: MxTransaction[];
      pagination: { total_pages: number };
    }>(
      `/users/${userGuid}/members/${memberGuid}/transactions?page=${page}&records_per_page=100${fromParam}`
    );
    transactions.push(...data.transactions);
    if (page >= data.pagination.total_pages) break;
    page++;
  }
  return transactions;
}
