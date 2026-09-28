/**
 * Admin accounts. Admins get the in-game admin panel and the dev commands, also on a
 * production server. Names come from FLOORS_ADMINS (comma separated; default "Ofir").
 */
export const ADMIN_NAMES = new Set(
  (process.env.FLOORS_ADMINS ?? "Ofir")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

export const isAdminName = (name: string) => ADMIN_NAMES.has(name.trim().toLowerCase());

/** Connections from the machine the server runs on. */
export function isLoopback(ip: string | undefined) {
  return !!ip && (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip === "localhost");
}

interface RequestInfo {
  ip?: string;
  headers?: Headers;
}
const FORWARD_HEADERS = ["x-forwarded-for", "x-real-ip", "x-client-ip", "forwarded"];

/**
 * Where a request really comes from. Colyseus believes the first X-Forwarded-For hop,
 * which the client can write itself. Behind a tunnel or proxy (ngrok, Cloudflare, nginx)
 * the trustworthy entry is the last one: the proxy appends the address it actually saw.
 */
export function clientAddress(ctx: RequestInfo | undefined): string {
  const xff = ctx?.headers?.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return ctx?.ip ?? "unknown";
}

/**
 * A request from the server machine itself, not relayed by anything: a tunnel such as
 * ngrok connects from localhost too, so any forwarding header disqualifies it.
 */
export function isServerMachine(ctx: RequestInfo | undefined) {
  if (FORWARD_HEADERS.some((h) => ctx?.headers?.get(h))) return false;
  return isLoopback(ctx?.ip);
}

/**
 * An admin name can only be registered from the server machine itself (or with
 * FLOORS_ADMIN_SETUP=1 once, on a remote host), so nobody else can claim it first.
 */
export const canRegisterAdminName = (ctx: RequestInfo | undefined) => isServerMachine(ctx) || process.env.FLOORS_ADMIN_SETUP === "1";
