// This is the Worker's actual entry point (see wrangler.jsonc's "main"). It
// wraps the fetch handler OpenNext generates at `.open-next/worker.js` --
// which only exports `fetch` -- so we can also add a `scheduled` handler for
// the daily balance-snapshot cron. The import below only resolves to a real
// module once `npm run cf:build` has produced `.open-next/worker.js`; see
// open-next-worker.d.ts for the stub that keeps this type-checking before that.

import handler from "./.open-next/worker.js";

const CRON_SNAPSHOT_URL = "https://lana.internal/api/cron/snapshot";

const workerEntry = {
  ...handler,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const secret = (env as Env & { CRON_SECRET?: string }).CRON_SECRET ?? "";
    const request = new Request(CRON_SNAPSHOT_URL, {
      method: "POST",
      headers: { "x-cron-secret": secret },
    });
    ctx.waitUntil(handler.fetch(request, env, ctx));
  },
};

export default workerEntry;
