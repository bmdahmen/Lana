const ERA_MCP_URL = "https://context.era.app";

interface McpToolResponse {
  jsonrpc: "2.0";
  id: number;
  result?: { content?: Array<{ type: string; text: string }> };
  error?: { code: number; message: string };
}

async function callEraToolOnce<T>(apiKey: string, name: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(ERA_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${apiKey}`,
      "User-Agent": "Lana/1.0 (+https://lana.bmdahmen.workers.dev)",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "<failed to read body>");
    console.error(
      `Era MCP call to ${name} failed`,
      JSON.stringify({
        status: res.status,
        statusText: res.statusText,
        contentType: res.headers.get("content-type"),
        server: res.headers.get("server"),
        cfRay: res.headers.get("cf-ray"),
        bodyLength: text.length,
        bodyPreview: text.slice(0, 500),
      })
    );
    throw new Error(`Era MCP error ${res.status}: ${text || "(empty body)"}`);
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

async function callEraTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const apiKey = process.env.ERA_API_KEY;
  if (!apiKey) {
    throw new Error("ERA_API_KEY must be set");
  }

  try {
    return await callEraToolOnce<T>(apiKey, name, args);
  } catch (error) {
    console.error(`Era MCP call to ${name} failed once, retrying in 500ms`, (error as Error).message);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return callEraToolOnce<T>(apiKey, name, args);
  }
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
