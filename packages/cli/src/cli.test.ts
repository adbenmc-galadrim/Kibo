import { afterAll, describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDaemon } from "@kibo/daemon/daemon";
import { copyFixture, DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import { startDevServer } from "./commands/dev";
import { runCli } from "./index";

const cleanups: (() => void | Promise<void>)[] = [];
afterAll(async () => {
  for (const c of cleanups.reverse()) await c();
});
function io() {
  const home = mkdtempSync(join(tmpdir(), "kibo-cli-"));
  cleanups.push(() => rmSync(home, { recursive: true, force: true }));
  const out: string[] = [];
  const err: string[] = [];
  return {
    home,
    out,
    err,
    io: {
      home,
      toolchain: DEV_TOOLCHAIN,
      out: (l: string) => out.push(l),
      err: (l: string) => err.push(l),
    },
  };
}

describe("kibo component", () => {
  test("usage on unknown commands", async () => {
    const t = io();
    expect(await runCli(["nope"], t.io)).toBe(2);
    expect(t.err.join("\n")).toContain("kibo component new <id>");
    expect(await runCli(["component", "explode", "x"], t.io)).toBe(2);
  });

  test("new scaffolds into KIBO_HOME/components/src", async () => {
    const t = io();
    expect(await runCli(["component", "new", "burndown", "--kind", "widget", "--server"], t.io)).toBe(0);
    const dir = join(t.home, "components", "src", "burndown");
    expect(existsSync(join(dir, "server.ts"))).toBe(true);
    expect(t.out).toEqual([
      `Composant créé : ${dir}`,
      "Ensuite : kibo component dev burndown, puis kibo component test burndown",
    ]);
    expect(await runCli(["component", "new", "burndown"], t.io)).toBe(1);
    expect(await runCli(["component", "new", "Bad_Id"], t.io)).toBe(1);
    expect(t.err.every((l) => l.startsWith("Erreur INVALID_INPUT : "))).toBe(true);
  });

  test("test validates a folder outside the monorepo and reports each step", async () => {
    const t = io();
    const f = copyFixture("hello");
    cleanups.push(f.dispose);
    expect(await runCli(["component", "test", f.dir], t.io)).toBe(0);
    expect(t.out).toContain("✓ Tests");
    expect(t.out).toContain("Composant valide : il apparaît dans « Mes composants ».");
    const bad = copyFixture("undeclared");
    cleanups.push(bad.dispose);
    expect(await runCli(["component", "test", bad.dir], t.io)).toBe(1);
    expect(t.out).toContain("  permission utilisée mais non déclarée : read:link");
  }, 240_000);

  test("publish explains a corrupt daemon.json without touching it", async () => {
    const t = io();
    const file = join(t.home, "daemon.json");
    writeFileSync(join(t.home, "token"), "secret");
    for (const content of ["{", JSON.stringify({ port: "x", sandboxPort: 1, pid: 1 })]) {
      writeFileSync(file, content);
      t.err.length = 0;
      expect(await runCli(["component", "publish", "hello"], t.io)).toBe(1);
      expect(t.err).toEqual([
        `Le fichier ${file} est corrompu : relance l'application Kibo, ou supprime ce fichier puis réessaie.`,
      ]);
      expect(readFileSync(file, "utf8")).toBe(content);
    }
  });

  test("publish talks to the running daemon and asks for a strategy when needed", async () => {
    const t = io();
    expect(await runCli(["component", "publish", "hello"], t.io)).toBe(1);
    expect(t.err).toContain("Le démon Kibo ne tourne pas : lance l'application Kibo, puis réessaie.");
    const daemon = await startDaemon({
      home: t.home,
      port: 0,
      sandboxPort: 0,
      uiDir: null,
      dev: false,
      toolchain: DEV_TOOLCHAIN,
      user: "adam",
    });
    cleanups.push(() => daemon.stop());
    const f = copyFixture("hello", { linkModules: false });
    cleanups.push(f.dispose);
    cpSync(f.dir, join(t.home, "components", "src", "hello"), { recursive: true });
    expect(await runCli(["component", "publish", "hello"], t.io)).toBe(0);
    expect(t.out).toContain("Version 0.1.0 publiée.");
    expect(t.out).toContain("Autorisation requise : ouvre Kibo (écran « Composants ») pour l'accorder.");
    expect(await runCli(["component", "publish", "hello"], t.io)).toBe(0);
    expect(t.out.at(-1)).toBe("Rien à publier : cette version est déjà publiée avec le même code.");
  }, 240_000);

  test("dev refuses a missing folder", async () => {
    const t = io();
    expect(await runCli(["component", "dev", "missing"], t.io)).toBe(1);
    expect(t.err).toEqual([
      `Erreur NOT_FOUND : component folder not found: ${join(t.home, "components", "src", "missing")}`,
    ]);
    expect(await runCli(["component", "dev", "x", "--port", "http"], t.io)).toBe(1);
    expect(t.err.at(-1)).toBe("Erreur INVALID_INPUT : invalid port: http");
  });

  test("dev serves a live preview", async () => {
    const f = copyFixture("hello");
    cleanups.push(f.dispose);
    const dev = await startDevServer(f.dir, DEV_TOOLCHAIN, { port: 0 });
    cleanups.push(dev.stop);
    const html = await (await fetch(dev.url)).text();
    expect(html).toContain('<script type="module" src="/app.js"></script>');
    const js = await fetch(`${dev.url}/app.js`);
    expect(js.status).toBe(200);
    expect(await js.text()).toContain("mountDev");
    expect((await fetch(`${dev.url}/app.css`)).status).toBe(200);
    expect((await fetch(`${dev.url}/version`)).status).toBe(200);
  }, 120_000);
});
