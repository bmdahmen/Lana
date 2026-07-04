const ERA_MCP_URL = "https://context.era.app";

interface McpToolResponse {
  jsonrpc: "2.0";
  id: number;
  result?: { content?: Array<{ type: string; text: string }> };
  error?: { code: number; message: string };
}

async function callEraTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const apiKey = process.env.ERA_API_KEY;
  if (!apiKey) {
    throw new Error("ERA_API_KEY must be set");
  }

  const res = await fetch(ERA_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Era MCP error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as McpToolResponse;
  if (data.error) {
    throw new Error(`Era MCP error: ${data.error.message}`);
  }

  const text = data.result?.content?.[0]?.text;
  if (!text) {
    throw new Error("Era MCP: empty tool response");
  }

  return JSON.parse(text) as T;
}

export interface EraAccount {
  account_group_key: string;
  name: string;
  institution: string;
  type: string;
  balance: { current?: number; available?: number; currency: string };
  visibility?: string;
}

export async function listEraAccounts(): Promise<EraAccount[]> {
  const data = await callEraTool<{ accounts: EraAccount[] }>(
    "accounts__list_financial_accounts",
    {}
  );
  return data.accounts;
}

export interface EraTransaction {
  transaction_id: string;
  account_group_key: string;
  amount: number;
  currency: string;
  description: string;
  merchant_name?: string;
  transaction_date: string;
  posted_date: string;
  is_pending: boolean;
  category?: string;
  is_cash_outflow: boolean;
}

export async function listEraTransactions(accountGroupKey: string): Promise<EraTransaction[]> {
  const transactions: EraTransaction[] = [];
  let page = 1;
  const pageSize = 100;
  for (;;) {
    const data = await callEraTool<{ transactions: EraTransaction[] }>(
      "transactions__list_transactions",
      { account_group_key: accountGroupKey, page, page_size: pageSize }
    );
    transactions.push(...data.transactions);
    if (data.transactions.length < pageSize) break;
    page++;
  }
  return transactions;
}
