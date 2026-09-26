export type SmokeDaemon = {
  rpc(body: Record<string, unknown>): Promise<unknown>;
  stop(): Promise<void>;
};

async function readyLine(stdout: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stdout.getReader();
  const decoder = new TextDecoder();
  let seen = "";
  for (;;) {
    const line = /KIBO_READY (\S+)\n/.exec(seen)?.[1];
    if (line) {
      reader.releaseLock();
      return line;
    }
    const { value, done } = await reader.read();
    if (done) throw new Error("daemon exited before KIBO_READY");
    seen += decoder.decode(value, { stream: true });
  }
}

async function pair(origin: string, token: string): Promise<string> {
  const res = await fetch(`${origin}/api/pair`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const cookie = res.headers.get("set-cookie")?.split(";")[0];
  if (res.status !== 204 || !cookie) throw new Error(`pairing failed with ${res.status}`);
  return cookie;
}

function resultOf(payload: unknown): unknown {
  if (typeof payload !== "object" || payload === null) throw new Error("invalid rpc response");
  if (Reflect.get(payload, "ok") !== true) throw new Error(`rpc failed: ${JSON.stringify(payload)}`);
  return Reflect.get(payload, "result");
}

export async function startSmokeDaemon(
  cmd: string[],
  env: Record<string, string | undefined>,
): Promise<SmokeDaemon> {
  const proc = Bun.spawn(cmd, { env, stdout: "pipe", stderr: "inherit" });
  const stop = async () => {
    proc.kill();
    await proc.exited;
  };
  try {
    const url = new URL(await readyLine(proc.stdout));
    const token = new URLSearchParams(url.hash.slice(1)).get("pair") ?? "";
    const cookie = await pair(url.origin, token);
    const rpc = async (body: Record<string, unknown>) => {
      const res = await fetch(`${url.origin}/api/rpc`, {
        method: "POST",
        headers: { origin: url.origin, cookie, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return resultOf(await res.json());
    };
    return { rpc, stop };
  } catch (e) {
    await stop();
    throw e;
  }
}
