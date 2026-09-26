import { afterAll, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { osSandbox } from "./os-sandbox";
import { copyFixture, DEV_TOOLCHAIN } from "./test-kit";
import { validateComponent } from "./validate";

const disposers: (() => void)[] = [];
afterAll(() => {
  for (const d of disposers) d();
});

const sandboxAvailable = await osSandbox()
  .ready()
  .then(
    () => true,
    (e: unknown) => {
      if (e instanceof KiboError && e.code === "SANDBOX_UNAVAILABLE") return false;
      throw e;
    },
  );

const hostileTest = (targets: string[], port: number) => `import { test } from "bun:test";
import { writeFileSync } from "node:fs";
import { connect } from "node:net";

test("tries to escape", async () => {
  for (const target of ${JSON.stringify(targets)}) {
    try {
      writeFileSync(target, "pwned");
      console.log("KIBO_WRITE_OK " + target);
    } catch {
      console.log("KIBO_WRITE_DENIED");
    }
  }
  const reached = await new Promise((resolve) => {
    const socket = connect(${port}, "127.0.0.1", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    setTimeout(() => resolve(false), 2_000);
  });
  console.log(reached ? "KIBO_NET_OK" : "KIBO_NET_DENIED");
});
`;

test.skipIf(!sandboxAvailable)(
  "code written by an agent runs its tests without writing outside its copy nor reaching the network",
  async () => {
    const f = copyFixture("hello");
    disposers.push(f.dispose);
    const outside = mkdtempSync(join(tmpdir(), "kibo-victim-"));
    disposers.push(() => rmSync(outside, { recursive: true, force: true }));
    let connections = 0;
    const listener = Bun.listen({
      hostname: "127.0.0.1",
      port: 0,
      socket: {
        open: () => {
          connections += 1;
        },
        data: () => {},
      },
    });
    const targets = [join(outside, "pwned"), join(f.dir, "pwned.txt")];
    writeFileSync(join(f.dir, "escape.test.tsx"), hostileTest(targets, listener.port));
    try {
      const report = await validateComponent(f.dir, { toolchain: DEV_TOOLCHAIN });
      expect(report.tests.output).toContain("KIBO_NET_DENIED");
      expect(report.tests.output.match(/KIBO_WRITE_DENIED/g)?.length).toBe(2);
      expect(report.tests.output).not.toContain("KIBO_WRITE_OK");
      expect(targets.some((t) => existsSync(t))).toBe(false);
      expect(connections).toBe(0);
    } finally {
      listener.stop(true);
    }
  },
  120_000,
);
