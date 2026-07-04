import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

function getPlaidEnv(): keyof typeof PlaidEnvironments {
  const env = process.env.PLAID_ENV ?? "sandbox";
  if (env !== "sandbox" && env !== "development" && env !== "production") {
    throw new Error(`Invalid PLAID_ENV: ${env}`);
  }
  return env;
}

let client: PlaidApi | null = null;

export function getPlaidClient(): PlaidApi {
  if (client) return client;

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!clientId || !secret) {
    throw new Error("PLAID_CLIENT_ID and PLAID_SECRET must be set");
  }

  const configuration = new Configuration({
    basePath: PlaidEnvironments[getPlaidEnv()],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });

  client = new PlaidApi(configuration);
  return client;
}
