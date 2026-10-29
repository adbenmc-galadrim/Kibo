import type { HookPost } from "@kibo/schema";
import { serveMcp } from "./ask-mcp";
import { reduceHookPost } from "./hook-payload";

export type PostFn = (url: string, init: RequestInit) => Promise<Response>;

export type ForwardInput = {
  stdin: string;
  env: Record<string, string | undefined>;
  fetch?: PostFn;
  log?: (line: string) => void;
  out?: (text: string) => void;
};

export const FAIL_CLOSED_DENY = JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: "Kibo n'a pas pu vérifier cette action.",
  },
});

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isPreToolUse = (raw: unknown) =>
  typeof raw === "object" && raw !== null && "hook_event_name" in raw && raw.hook_event_name === "PreToolUse";

export async function forwardHook({
  stdin,
  env,
  fetch: send = fetch,
  log = (line) => process.stderr.write(`${line}\n`),
  out = (text) => process.stdout.write(text),
}: ForwardInput): Promise<number> {
  let guarded = true;
  const refuse = (reason: string): number => {
    log(`kibo-hook: ${reason}`);
    if (!guarded) return 1;
    out(FAIL_CLOSED_DENY);
    return 0;
  };
  let raw: unknown;
  try {
    raw = JSON.parse(stdin);
  } catch (e) {
    return refuse(`invalid hook input: ${message(e)}`);
  }
  guarded = isPreToolUse(raw);
  const url = env.KIBO_HOOK_URL;
  const token = env.KIBO_RUN_TOKEN;
  if (!url || !token) return refuse("KIBO_HOOK_URL and KIBO_RUN_TOKEN are required");
  let post: HookPost;
  try {
    post = reduceHookPost(raw);
  } catch (e) {
    return refuse(`invalid hook input: ${message(e)}`);
  }
  try {
    const res = await send(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(post),
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 200) {
      out(await res.text());
      return 0;
    }
    if (res.ok) return 0;
    return refuse(`daemon answered ${res.status}`);
  } catch (e) {
    return refuse(`daemon unreachable: ${message(e)}`);
  }
}

if (import.meta.main) {
  const mode = process.argv[2];
  if (mode === "mcp") {
    await serveMcp(process.stdin, process.stdout, process.env);
  } else if (mode === "event") {
    process.exit(await forwardHook({ stdin: await Bun.stdin.text(), env: process.env }));
  } else {
    process.stderr.write("usage: kibo-hook event|mcp\n");
    process.exit(64);
  }
}
