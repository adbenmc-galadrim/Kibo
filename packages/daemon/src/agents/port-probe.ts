const PROBE_HOSTS = ["127.0.0.1", "0.0.0.0", "::1"];
const UNAVAILABLE_HOST = new Set(["EADDRNOTAVAIL", "EAFNOSUPPORT"]);

const errorCode = (e: unknown): string | null =>
  e instanceof Error && "code" in e && typeof e.code === "string" ? e.code : null;

function freeOn(hostname: string, port: number): boolean {
  try {
    Bun.listen({ hostname, port, socket: { data() {} } }).stop(true);
    return true;
  } catch (e) {
    return UNAVAILABLE_HOST.has(errorCode(e) ?? "");
  }
}

export async function isFree(port: number): Promise<boolean> {
  return PROBE_HOSTS.every((hostname) => freeOn(hostname, port));
}
