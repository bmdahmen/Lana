#!/usr/bin/env node
// Runs outside Cloudflare's network (GitHub Actions), which is required —
// Era's WAF blocks requests originating from Cloudflare Workers. Fetches
// accounts + transactions directly from Era's MCP server, then POSTs the
// result to Lana's /api/era/ingest for it to apply to the database.

const ERA_MCP_URL = "https://context.era.app";

const ERA_API_KEY = requireEnv("ERA_API_KEY");
const LANA_URL = requireEnv("LANA_URL");
const LANA_SYNC_SECRET = requireEnv("LANA_SYNC_SECRET");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

let requestId = 0;

async function callEraTool(name, args = {}) {
  requestId += 1;
  const res = await fetch(ERA_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${ERA_API_KEY}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: requestId,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(
      "Era MCP call failed",
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

  const data = await res.json();
  if (data.error) {
    throw new Error(`Era MCP error: ${data.error.message}`);
  }

  const text = data.result?.content?.[0]?.text;
  if (!text) {
    throw new Error("Era MCP: empty tool response");
  }

  return JSON.parse(text);
}

async function listAccounts() {
  const data = await callEraTool("accounts__list_financial_accounts", {});
  return data.accounts;
}

async function listTransactions(accountGroupKey) {
  const transactions = [];
  let page = 1;
  const pageSize = 100;
  for (;;) {
    const data = await callEraTool("transactions__list_transactions", {
      account_group_key: accountGroupKey,
      page,
      page_size: pageSize,
    });
    transactions.push(...data.transactions);
    if (data.transactions.length < pageSize) break;
    page++;
  }
  return transactions;
}

async function main() {
  console.log("Fetching accounts from Era...");
  const accounts = await listAccounts();
  console.log(`Got ${accounts.length} account(s).`);

  const visibleAccounts = accounts.filter((a) => a.balance.current !== undefined);
  console.log(
    `${visibleAccounts.length} account(s) have visible balances; ${accounts.length - visibleAccounts.length} skipped (Era plan limits).`
  );

  const transactions = [];
  for (const account of visibleAccounts) {
    const accountTransactions = await listTransactions(account.account_group_key);
    console.log(`  ${account.name}: ${accountTransactions.length} transaction(s)`);
    transactions.push(...accountTransactions);
  }

  console.log(`Posting ${accounts.length} account(s) and ${transactions.length} transaction(s) to Lana...`);
  const res = await fetch(`${LANA_URL}/api/era/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sync-Secret": LANA_SYNC_SECRET,
    },
    body: JSON.stringify({ accounts, transactions }),
  });

  const result = await res.json();
  if (!res.ok) {
    throw new Error(`Lana ingest error ${res.status}: ${JSON.stringify(result)}`);
  }

  console.log("Done:", result);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
