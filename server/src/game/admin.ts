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

/**
 * An admin name can only be registered from the server machine itself (or with
 * FLOORS_ADMIN_SETUP=1 once, on a remote host), so nobody else can claim it first.
 */
export const canRegisterAdminName = (ip: string | undefined) => isLoopback(ip) || process.env.FLOORS_ADMIN_SETUP === "1";
