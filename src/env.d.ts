declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- declaration merging with @opennextjs/cloudflare's CloudflareEnv
  interface CloudflareEnv extends Env {}
}

export {};
