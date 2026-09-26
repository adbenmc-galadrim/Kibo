const LOCAL_HOSTS = new Set(["", "127.0.0.1", "localhost", "[::1]", "::1"]);

export function isRemoteView(hostname: string = globalThis.location.hostname): boolean {
  return !LOCAL_HOSTS.has(hostname);
}
