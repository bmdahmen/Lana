import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import type { Owner } from "@/lib/owners";

// Brian's credentials keep the original unsuffixed env var names (already
// set in production); each additional household member gets their own
// Plaid account, so their keys live under an owner-suffixed name instead.
function envSuffix(owner: Owner): string {
  return owner === "brian" ? "" : `_${owner.toUpperCase()}`;
}

function getPlaidEnv(owner: Owner): keyof typeof PlaidEnvironments {
  const suffix = envSuffix(owner);
  const env = process.env[`PLAID_ENV${suffix}`] ?? process.env.PLAID_ENV ?? "sandbox";
  if (env !== "sandbox" && env !== "development" && env !== "production") {
    throw new Error(`Invalid PLAID_ENV${suffix}: ${env}`);
  }
  return env;
}

const clients = new Map<Owner, PlaidApi>();

export function getPlaidClient(owner: Owner = "brian"): PlaidApi {
  const cached = clients.get(owner);
  if (cached) return cached;

  const suffix = envSuffix(owner);
  const clientId = process.env[`PLAID_CLIENT_ID${suffix}`];
  const secret = process.env[`PLAID_SECRET${suffix}`];
  if (!clientId || !secret) {
    throw new Error(`PLAID_CLIENT_ID${suffix} and PLAID_SECRET${suffix} must be set`);
  }

  const configuration = new Configuration({
    basePath: PlaidEnvironments[getPlaidEnv(owner)],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });

  const client = new PlaidApi(configuration);
  clients.set(owner, client);
  return client;
}
