import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type SmokeDaemon, startSmokeDaemon } from "./smoke-daemon";

const root = resolve(import.meta.dir, "../../..");
const work = mkdtempSync(join(tmpdir(), "kibo-cli-smoke-"));
const bin = join(work, "kibo-daemon");
const toolchain = join(work, "toolchain");
const home = join(work, "home");
const env = { ...process.env, KIBO_HOME: home, KIBO_TOOLCHAIN: undefined };

function run(cmd: string[], expectedExit = 0): string {
  const p = Bun.spawnSync(cmd, { cwd: work, env, stdout: "pipe", stderr: "inherit", timeout: 300_000 });
  const out = p.stdout.toString();
  process.stdout.write(out);
  if (p.exitCode !== expectedExit) throw new Error(`${cmd.join(" ")} exited with ${p.exitCode}`);
  return out;
}

function text(value: unknown, key: string): string {
  const field: unknown = typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
  if (typeof field !== "string") throw new Error(`missing ${key} in ${JSON.stringify(value)}`);
  return field;
}

async function publishedHash(daemon: SmokeDaemon): Promise<string> {
  const list = await daemon.rpc({ method: "listComponents" });
  const smoke = Array.isArray(list) ? list.find((c: unknown) => text(c, "id") === "smoke") : undefined;
  const versions: unknown = smoke ? Reflect.get(smoke, "versions") : undefined;
  if (!Array.isArray(versions) || versions.length !== 1) throw new Error("smoke 0.1.0 is not published");
  return text(versions[0], "hash");
}

async function pingInstance(daemon: SmokeDaemon): Promise<(trust: string) => Promise<void>> {
  const hash = await publishedHash(daemon);
  const project = await daemon.rpc({
    method: "createProject",
    name: "Smoke",
    key: "SMK",
    folder: null,
    color: "#F97316",
  });
  const projectId = text(project, "id");
  const page = await daemon.rpc({
    method: "command",
    projectId,
    command: { method: "addPage", title: "Tableau de bord", kind: "dashboard" },
  });
  const instance = await daemon.rpc({
    method: "command",
    projectId,
    command: { method: "addInstance", pageId: text(page, "id"), component: "smoke@0.1.0" },
  });
  return async (trust) => {
    await daemon.rpc({ method: "approveComponent", id: "smoke", version: "0.1.0", hash, trust });
    const answer = await daemon.rpc({
      method: "componentCall",
      projectId,
      instanceId: text(instance, "id"),
      call: { kind: "action", name: "ping", input: null },
    });
    if (answer !== "pong") throw new Error(`${trust} backend answered ${JSON.stringify(answer)}`);
    console.log(`${trust} backend: pong`);
  };
}

try {
  run(["bun", join(root, "apps/desktop/scripts/build-sidecar.ts"), "--out", bin]);
  run(["bun", join(root, "apps/desktop/scripts/build-toolchain.ts"), "--out", toolchain]);
  mkdirSync(join(work, "bin"));
  const kibo = join(work, "bin", "kibo");
  symlinkSync(bin, kibo);
  run([kibo], 2);
  run([kibo, "component", "new", "smoke", "--server"]);
  run([kibo, "component", "test", "smoke"]);
  const daemon = await startSmokeDaemon([bin, "--port", "0", "--toolchain", toolchain], env);
  try {
    run([kibo, "component", "publish", "smoke"]);
    const ping = await pingInstance(daemon);
    await ping("trusted");
    await ping("sandboxed");
  } finally {
    await daemon.stop();
  }
  console.log("cli smoke: ok");
} finally {
  rmSync(work, { recursive: true, force: true });
}
