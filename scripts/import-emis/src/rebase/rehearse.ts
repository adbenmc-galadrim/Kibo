import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectPatch } from "@kibo/schema";
import type { Subprocess } from "bun";
import { connectLocalDaemon, readDaemonAccess, type SeedClient } from "../daemon-client";
import { type SeedProgress, seedPlan } from "./apply-new";
import type { OldProject } from "./old-project";
import type { RebasePlan } from "./plan-file";
import { verifyRebase } from "./verify";

export type TempDaemon = {
  home: string;
  withClient<T>(run: (client: SeedClient) => Promise<T>): Promise<T>;
  stop(): Promise<void>;
};

const DAEMON_MAIN = join(import.meta.dir, "..", "..", "..", "..", "packages", "daemon", "src", "main.ts");
const ISOLATED = ["--memory-secrets", "--test-origins", "api.github.com=http://127.0.0.1:9"];

async function waitReady(proc: Subprocess<"ignore", "pipe", "ignore">): Promise<void> {
  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();
  let out = "";
  while (!out.includes("KIBO_READY")) {
    const { value, done } = await reader.read();
    if (done) throw new Error("temporary daemon exited before being ready");
    out += decoder.decode(value);
  }
  reader.releaseLock();
}

export async function startTempDaemon(home: string, options: { version?: string } = {}): Promise<TempDaemon> {
  const version = options.version ? { KIBO_VERSION: options.version } : {};
  const proc = Bun.spawn(["bun", DAEMON_MAIN, "--port", "0", ...ISOLATED], {
    env: { ...process.env, KIBO_HOME: home, ...version },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "ignore",
  });
  await waitReady(proc);
  return {
    home,
    async withClient(run) {
      const client = await connectLocalDaemon(readDaemonAccess(home));
      try {
        return await run(client);
      } finally {
        await client.close();
      }
    },
    async stop() {
      proc.kill("SIGTERM");
      await proc.exited;
    },
  };
}

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export async function rehearse(
  plan: RebasePlan,
  old: OldProject,
  settings: ProjectPatch | null = null,
): Promise<string[]> {
  const home = mkdtempSync(join(tmpdir(), "kibo-rebase-rehearsal-"));
  try {
    const daemon = await startTempDaemon(home);
    try {
      return await daemon.withClient(async (client) => {
        const progress: SeedProgress = { projectId: null };
        try {
          const { projectId } = await seedPlan(client, plan, progress, settings);
          const fresh = await client.rpc({ method: "getProject", projectId });
          return verifyRebase(old, fresh, plan);
        } catch (e) {
          return [`répétition interrompue : ${messageOf(e)}`];
        }
      });
    } finally {
      await daemon.stop();
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}
