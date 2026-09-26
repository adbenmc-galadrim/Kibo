export type ProxyRule = { target: string; changeOrigin: true; ws?: true };

export function devProxy(daemon: string): Record<string, ProxyRule> {
  return {
    "/api": { target: daemon, changeOrigin: true, ws: true },
    "/components": { target: daemon, changeOrigin: true },
  };
}
