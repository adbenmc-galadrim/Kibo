import { afterAll, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { KiboError } from "@kibo/schema";
import { FR_DEVKIT } from "./fr";
import { type OsSandbox, osSandbox } from "./os-sandbox";
import { scaffold } from "./scaffold";
import { copyFixture, DEV_TOOLCHAIN } from "./test-kit";
import { readValidationStamp, validateComponent } from "./validate";

const disposers: (() => void)[] = [];
afterAll(() => {
  for (const d of disposers) d();
});
const fixture = (name: string) => {
  const f = copyFixture(name);
  disposers.push(f.dispose);
  return f.dir;
};
const opts = { toolchain: DEV_TOOLCHAIN, now: () => 1_000 };

const sandboxAvailable = await osSandbox()
  .ready()
  .then(
    () => true,
    (e: unknown) => {
      if (e instanceof KiboError && e.code === "SANDBOX_UNAVAILABLE") return false;
      throw e;
    },
  );

const hasCode = (e: unknown, codes: string[]) =>
  e instanceof Error && "code" in e && typeof e.code === "string" && codes.includes(e.code);

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    if (hasCode(e, ["ESRCH"])) return false;
    throw e;
  }
}

function cwdOf(pid: string): string | null {
  try {
    return readlinkSync(`/proc/${pid}/cwd`);
  } catch (e) {
    if (hasCode(e, ["ENOENT", "ESRCH", "EACCES"])) return null;
    throw e;
  }
}

const anyProcessIn = (dir: string) =>
  readdirSync("/proc")
    .filter((entry) => /^\d+$/.test(entry))
    .some((pid) => cwdOf(pid)?.startsWith(dir) ?? false);

// inside bubblewrap the pid a test prints belongs to its own pid namespace
const hangingTestAlive = (pid: number, cwd: string) =>
  process.platform === "linux" ? anyProcessIn(cwd) : pidAlive(pid);

async function hangingTestGone(pid: number, cwd: string): Promise<boolean> {
  for (let i = 0; i < 100; i += 1) {
    if (!hangingTestAlive(pid, cwd)) return true;
    await Bun.sleep(20);
  }
  return false;
}

const HANGING_TEST = `import { test } from "bun:test";

test("never ends", async () => {
  console.log(\`KIBO_HANG \${process.pid} \${process.cwd()}\`);
  setInterval(() => undefined, 1_000);
  await new Promise(() => undefined);
}, 600_000);
`;

describe("validateComponent", () => {
  test("hello passes every step and gets stamped", async () => {
    const dir = fixture("hello");
    const report = await validateComponent(dir, opts);
    expect(report.ok).toBe(true);
    expect(report.tests.passed).toBeGreaterThanOrEqual(9);
    expect(report.permissions).toMatchObject({
      declared: ["read:ticket"],
      used: ["read:ticket"],
      missing: [],
      unused: [],
    });
    expect(report.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await readValidationStamp(dir)).toEqual({
      hash: report.hash ?? "",
      version: "0.1.0",
      ok: true,
      at: 1_000,
    });
    expect(readdirSync(dir).sort()).toEqual([
      ".kibo",
      "component.test.tsx",
      "kibo.component.json",
      "node_modules",
      "ui.tsx",
    ]);
  }, 120_000);
  test("a scaffolded component typechecks and passes", async () => {
    const root = mkdtempSync(join(tmpdir(), "kibo-validate-scaffold-"));
    disposers.push(() => rmSync(root, { recursive: true, force: true }));
    const dir = await scaffold({
      root,
      id: "acme.burndown",
      kind: "both",
      server: true,
      toolchain: DEV_TOOLCHAIN,
    });
    const report = await validateComponent(dir, opts);
    expect(report.typecheck).toEqual({ ok: true, errors: [] });
    expect(report.ok).toBe(true);
  }, 120_000);
  test("a type error is reported with its location", async () => {
    const dir = fixture("failing");
    writeFileSync(
      join(dir, "ui.tsx"),
      'const n: number = "x";\nexport function Component() {\n  return <p>{n}</p>;\n}\n',
    );
    const report = await validateComponent(dir, opts);
    expect(report.ok).toBe(false);
    expect(report.typecheck.errors).toHaveLength(1);
    expect(report.typecheck.errors[0]).toStartWith("ui.tsx:1 · ");
  }, 120_000);
  test("a fixed width in ui.tsx fails the conformance step", async () => {
    const dir = fixture("hello");
    const ui = join(dir, "ui.tsx");
    writeFileSync(ui, readFileSync(ui, "utf8").replace('"h-full ', '"h-full w-[480px] '));
    const report = await validateComponent(dir, opts);
    expect(report.tests.ok).toBe(true);
    expect(report.ok).toBe(false);
    expect(report.conformance.ok).toBe(false);
    expect(report.conformance.errors).toContain(FR_DEVKIT.fixedWidth("ui.tsx", "w-[480px]"));
    expect(report.conformance.errors.join("\n")).toContain("largeur fixe");
  }, 120_000);
  test("a forbidden import fails the imports step", async () => {
    const report = await validateComponent(fixture("bad-import"), opts);
    expect(report.ok).toBe(false);
    expect(report.imports.errors).toEqual(["ui.tsx:1 · import interdit : node:fs"]);
  }, 120_000);
  test("a non-literal argument cannot be checked", async () => {
    const report = await validateComponent(fixture("non-literal"), opts);
    expect(report.ok).toBe(false);
    expect(report.permissions.errors[0]).toContain("argument non littéral");
  }, 120_000);
  test("an undeclared read is missing, both statically and at runtime", async () => {
    const report = await validateComponent(fixture("undeclared"), opts);
    expect(report.ok).toBe(false);
    expect(report.permissions.missing).toEqual(["read:link"]);
    expect(report.conformance.ok).toBe(false);
  }, 120_000);
  test("a failing test fails the report with the runner output", async () => {
    const report = await validateComponent(fixture("failing"), opts);
    expect(report.tests).toMatchObject({ ok: false, failed: 1 });
    expect(report.tests.output).toContain("fails on purpose");
  }, 120_000);
  test("an invalid or reserved manifest stops before the tests", async () => {
    const dir = fixture("hello");
    writeFileSync(
      join(dir, "kibo.component.json"),
      JSON.stringify({ id: "kanban", version: "0.1.0", kind: "widget", title: "K", reads: [], writes: [] }),
    );
    const report = await validateComponent(dir, opts);
    expect(report.manifest).toEqual({
      ok: false,
      errors: ["identifiant réservé à un composant intégré : kanban"],
    });
    expect(report.tests.passed + report.tests.failed).toBe(0);
    writeFileSync(
      join(dir, "kibo.component.json"),
      JSON.stringify({
        id: "hello",
        version: "0.1.0",
        kind: "widget",
        title: "H",
        reads: [],
        writes: [],
        mcp: ["{config.server}"],
      }),
    );
    expect((await validateComponent(dir, opts)).manifest).toEqual({
      ok: false,
      errors: ["{config.server} est réservé aux composants intégrés"],
    });
    writeFileSync(
      join(dir, "kibo.component.json"),
      JSON.stringify({
        id: "hello",
        version: "0.1.0",
        kind: "widget",
        title: "H",
        reads: [],
        writes: [],
        mcp: ["context7", "figma/get_metadata"],
      }),
    );
    expect((await validateComponent(dir, opts)).manifest).toEqual({
      ok: false,
      errors: ["serveur MCP réservé à Kibo : figma"],
    });
    writeFileSync(join(dir, "kibo.component.json"), "{");
    expect((await validateComponent(dir, opts)).manifest.ok).toBe(false);
  }, 120_000);
  test("a manifest whose formats contradict its kind stops before the tests", async () => {
    const dir = fixture("hello");
    const manifest = { id: "hello", version: "0.1.0", kind: "view", title: "H", reads: [], writes: [] };
    writeFileSync(join(dir, "kibo.component.json"), JSON.stringify({ ...manifest, formats: ["large"] }));
    const report = await validateComponent(dir, opts);
    expect(report.manifest).toEqual({
      ok: false,
      errors: ["INVALID_MANIFEST: a view declares the full format"],
    });
    expect(report.tests.passed + report.tests.failed).toBe(0);
  }, 120_000);
  test("a manifest whose size minimum exceeds its maximum stops before the tests", async () => {
    const dir = fixture("hello");
    const manifest = { id: "hello", version: "0.1.0", kind: "widget", title: "H", reads: [], writes: [] };
    const size = { min: { w: 6, h: 6 }, max: { w: 4, h: 4 } };
    writeFileSync(join(dir, "kibo.component.json"), JSON.stringify({ ...manifest, size }));
    const report = await validateComponent(dir, opts);
    expect(report.manifest).toEqual({ ok: false, errors: ["INVALID_MANIFEST: size.min exceeds size.max"] });
    expect(report.tests.passed + report.tests.failed).toBe(0);
  }, 120_000);
  test("a manifest with repeated capabilities stops before the tests", async () => {
    const dir = fixture("hello");
    const manifest = { id: "hello", version: "0.1.0", kind: "widget", title: "H", reads: [], writes: [] };
    writeFileSync(
      join(dir, "kibo.component.json"),
      JSON.stringify({ ...manifest, capabilities: ["webgl", "webgl"] }),
    );
    const report = await validateComponent(dir, opts);
    expect(report.manifest).toEqual({ ok: false, errors: ["INVALID_MANIFEST: capabilities must be unique"] });
    expect(report.tests.passed + report.tests.failed).toBe(0);
  }, 120_000);
  test("the stamp lives in a hidden folder and never changes the hash", async () => {
    const dir = fixture("hello");
    const first = await validateComponent(dir, opts);
    const second = await validateComponent(dir, opts);
    expect(second.hash).toBe(first.hash);
    expect(existsSync(join(dir, ".kibo", "validation.json"))).toBe(true);
  }, 240_000);
  test("without an OS sandbox the component tests are not run", async () => {
    const unavailable: OsSandbox = {
      ready: async () => {
        throw new KiboError("SANDBOX_UNAVAILABLE", "bwrap is not installed");
      },
      diagnose: async () => ({
        kind: "bwrap",
        available: false,
        reason: "bwrap is not installed",
        fix: null,
      }),
      wrap: () => [],
    };
    const report = await validateComponent(fixture("hello"), { ...opts, sandbox: unavailable });
    expect(report.ok).toBe(false);
    expect(report.tests).toMatchObject({ ok: false, passed: 0, failed: 0 });
    expect(report.tests.output).toContain("bac à sable du système indisponible");
  }, 120_000);
  test("a symbolic link in the sources is refused before any test runs", async () => {
    const dir = fixture("hello");
    symlinkSync(join(dir, "ui.tsx"), join(dir, "linked.tsx"));
    const calls: string[] = [];
    const spy: OsSandbox = {
      ready: async () => {
        calls.push("ready");
      },
      diagnose: async () => {
        calls.push("diagnose");
        return { kind: "bwrap", available: true, reason: null, fix: null };
      },
      wrap: () => {
        calls.push("wrap");
        throw new KiboError("INTERNAL", "the component tests must not run");
      },
    };
    const report = await validateComponent(dir, { ...opts, sandbox: spy });
    expect(report.ok).toBe(false);
    expect(report.manifest).toEqual({
      ok: false,
      errors: ["sources refusées : symbolic link not allowed: linked.tsx"],
    });
    expect(report.tests).toEqual({ ok: false, passed: 0, failed: 0, output: "" });
    expect(calls).toEqual([]);
    expect(await readValidationStamp(dir)).toBeNull();
  }, 120_000);
});

test.skipIf(!sandboxAvailable)(
  "a test that never ends is killed and reported as timed out",
  async () => {
    const dir = fixture("hello");
    writeFileSync(join(dir, "component.test.tsx"), HANGING_TEST);
    const report = await validateComponent(dir, { ...opts, timeoutMs: 4_000 });
    expect(report.ok).toBe(false);
    expect(report.tests.ok).toBe(false);
    expect(report.tests.failed).toBeGreaterThanOrEqual(1);
    expect(report.tests.output).toStartWith(FR_DEVKIT.timeout(4));
    const hang = report.tests.output.match(/KIBO_HANG (\d+) (\S+)/);
    expect(hang).not.toBeNull();
    const [, pid = "", cwd = ""] = hang ?? [];
    expect(await hangingTestGone(Number(pid), cwd)).toBe(true);
    expect(basename(dirname(cwd))).toStartWith("kibo-validate-");
    expect(existsSync(dirname(cwd))).toBe(false);
  },
  60_000,
);

function validationChildren(): number[] {
  const out = Bun.spawnSync(["ps", "-A", "-o", "pid=,ppid=,stat=,command="]).stdout.toString();
  return out
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter(([, ppid, stat, ...command]) => {
      const child = Number(ppid) === process.pid && !stat?.startsWith("Z");
      return child && command.join(" ").includes("kibo-validate-");
    })
    .map(([pid]) => Number(pid));
}

test.skipIf(!sandboxAvailable)(
  "an aborted validation kills its test process and rejects",
  async () => {
    const dir = fixture("hello");
    writeFileSync(join(dir, "component.test.tsx"), HANGING_TEST);
    const abort = new AbortController();
    const outcome = validateComponent(dir, { ...opts, signal: abort.signal }).then(
      () => "resolved",
      (e: unknown) => (e instanceof KiboError ? `${e.code} ${e.detail}` : String(e)),
    );
    for (const started = Date.now(); validationChildren().length === 0; await Bun.sleep(50)) {
      if (Date.now() - started > 30_000) throw new Error("the test process never started");
    }
    await Bun.sleep(200);
    const aborted = Date.now();
    abort.abort();
    expect(await outcome).toBe("INTERNAL validation aborted");
    expect(Date.now() - aborted).toBeLessThan(2_000);
    expect(validationChildren()).toEqual([]);
  },
  60_000,
);

test("a validation aborted before it starts rejects without running anything", async () => {
  const dir = fixture("hello");
  const abort = new AbortController();
  abort.abort();
  const run = validateComponent(dir, { ...opts, signal: abort.signal });
  await expect(run).rejects.toMatchObject({ code: "INTERNAL", detail: "validation aborted" });
  expect(await readValidationStamp(dir)).toBeNull();
});

describe("readValidationStamp", () => {
  test("an invalid stamp is treated as absent", async () => {
    const dir = fixture("hello");
    mkdirSync(join(dir, ".kibo"));
    const stamp = join(dir, ".kibo", "validation.json");
    const invalid = [
      { hash: "abc", version: "0.1.0", ok: "yes", at: 1 },
      { hash: 1, version: "0.1.0", ok: true, at: 1 },
      { version: "0.1.0", ok: true, at: 1 },
      [],
      null,
      "stamp",
    ];
    for (const value of invalid) {
      writeFileSync(stamp, JSON.stringify(value));
      expect(await readValidationStamp(dir)).toBeNull();
    }
    writeFileSync(stamp, JSON.stringify({ hash: "abc", version: "0.1.0", ok: true, at: 1, extra: 2 }));
    expect(await readValidationStamp(dir)).toEqual({ hash: "abc", version: "0.1.0", ok: true, at: 1 });
  });
});
