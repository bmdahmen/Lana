@AGENTS.md

# Git workflow

This is a personal, single-user project — there's no one else to review a PR,
and nothing is ever risky enough to leave dangling since it can always be
reverted. Feature work should end with a direct push to `main`, not a
dangling PR branch: if you did the work on a feature/session branch, merge
it into `main` and push `main` yourself as the last step, rather than
leaving it sitting on the branch waiting for someone to merge it. Skip
opening a pull request unless explicitly asked for one.

# Cloudflare access

You have direct access to this project's Cloudflare account via the
Cloudflare Developer Platform connector, including the production D1
database (`lana`). Use `d1_databases_list` / `d1_database_query` to run
migrations and inspect or fix data yourself — do not ask the user to run
`wrangler d1 execute` or SQL against production. Only ask the user to run
something yourself when it genuinely requires access you don't have (e.g.
a dashboard-only setting).
