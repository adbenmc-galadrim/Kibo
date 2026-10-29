import { afterAll, describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDaemon } from "@kibo/daemon/daemon";
import { copyFixture, DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import { decodeKpkg } from "@kibo/trust";
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
    expect(t.err.join("\n")).toContain("kibo market pack <id>@<version>");
  });

  test("the tickets help lists session and step --update", async () => {
    const t = io();
    expect(await runCli(["tickets"], t.io)).toBe(2);
    expect(t.err.at(-1)).toContain("kibo tickets session [<clé>] <start|ping|stop> [--tool <nom>]");
    expect(t.err.at(-1)).toContain("kibo tickets step <clé> <0-11> [note] [--update] [--json]");
  });

  test("the help lists the write commands", async () => {
    const t = io();
    expect(await runCli(["--help"], t.io)).toBe(0);
    const help = t.out.at(-1) ?? "";
    const lines = [
      'kibo features create "<titre>" [--sprint <S>] [--description <texte|@fichier|@->] [--labels a,b] [--project <p>] [--json]',
      'kibo tickets create "<titre>" --feature <F|clé> [--description …] [--labels a,b] [--optional] [--project <p>] [--json]',
      "kibo tickets update <clé> [--title <t>] [--description …|--append …|--prepend …] [--labels a,b] [--project <p>] [--json]",
      "kibo tickets move <clé> --feature <F|clé> [--project <p>] [--json]",
      "kibo tickets link <A> --blocks <B> [--project <p>] [--json]",
      "kibo tickets unlink <A> <B> [--project <p>] [--json]",
      "[--feature <F|clé>] [--label <a[,b]>] [--fields key,title,status,sprint]",
      "kibo sprints create <code> [--name <nom>] --start AAAA-MM-JJ --end AAAA-MM-JJ --project <p> [--json]",
      "kibo sprints update <code> [--code <c>] [--name <n>] [--start <d>] [--end <d>] --project <p> [--json]",
      "kibo sprints assign <F> <S|--none> --project <p> [--json]",
      "kibo questions list <clé> [--all] [--project <p>] [--json]",
      'kibo questions add <clé> "<titre>" --option "A" [--option "B"…] [--context …] [--recipient <nom|id>] [--provisional "A"] [--blocking] [--project <p>] [--json]',
      'kibo questions answer <id|n°> "<réponse>" --project <p> [--json]',
      "kibo plan apply <fichier.yaml|json> [--dry-run] [--project <p>] [--json]",
      "kibo plan export [--md] --project <p>",
      "kibo rpc '<json>' | @fichier | @-",
    ];
    for (const line of lines) expect(help).toContain(line);
    const scoped: [string, string][] = [
      ["tickets", "kibo tickets link <A> --blocks <B>"],
      ["features", 'kibo features create "<titre>"'],
      ["sprints", "kibo sprints assign <F> <S|--none>"],
      ["questions", 'kibo questions answer <id|n°> "<réponse>"'],
      ["plan", "kibo plan apply <fichier.yaml|json> [--dry-run]"],
      ["rpc", "kibo rpc '<json>' | @fichier | @-"],
    ];
    for (const [scope, line] of scoped) {
      expect(await runCli([scope, "--help"], t.io)).toBe(0);
      expect(t.out.at(-1)).toContain(line);
    }
  });

  test("unknown subcommands of tickets, features, questions, plan print their usage", async () => {
    const t = io();
    const usage: [string[], string][] = [
      [["tickets", "create"], "kibo tickets create"],
      [["tickets", "create", "Tournée"], "kibo tickets create"],
      [["tickets", "link", "SILO-33"], "kibo tickets link"],
      [["tickets", "link", "SILO-33", "--blocks"], "kibo tickets link"],
      [["tickets", "unlink", "SILO-33"], "kibo tickets unlink"],
      [["tickets", "move", "SILO-33"], "kibo tickets move"],
      [["tickets", "update", "SILO-33", "--title"], "kibo tickets update"],
      [["tickets", "nope"], "kibo tickets list"],
      [["features"], "kibo features create"],
      [["features", "nope"], "kibo features create"],
      [["questions"], "kibo questions add"],
      [["questions", "nope"], "kibo questions list"],
      [["plan"], "kibo plan apply"],
      [["plan", "nope"], "kibo plan export"],
      [["plan", "apply"], "kibo plan apply"],
      [["rpc"], "kibo rpc"],
    ];
    for (const [argv, line] of usage) {
      expect(await runCli(argv, t.io)).toBe(2);
      expect(t.err.at(-1)).toContain(line);
    }
  });

  test("--help tells how to reach a daemon, --home picks its folder", async () => {
    const t = io();
    const daemon = "Démon : $KIBO_HOME/daemon.json (défaut ~/.kibo), ou --home <dossier>";
    expect(await runCli(["--help"], t.io)).toBe(0);
    expect(t.out.at(-1)).toContain(daemon);
    expect(await runCli(["tickets", "--help"], t.io)).toBe(0);
    expect(t.out.at(-1)).toContain(daemon);
    expect(t.out.at(-1)).toContain("kibo tickets set <clé|id du plan>");
    const elsewhere = join(t.home, "elsewhere");
    writeFileSync(join(t.home, "daemon.json"), "{corrupt");
    expect(await runCli(["tickets", "list", "--project", "SILO", "--home", elsewhere], t.io)).toBe(1);
    expect(t.err.at(-1)).toBe("Kibo n'est pas lancé : ouvre l'application Kibo, puis réessaie.");
  });

  test("market prints its usage and explains a missing daemon", async () => {
    const t = io();
    expect(await runCli(["market"], t.io)).toBe(2);
    expect(t.err.at(-1)).toContain("kibo market index --dir <dossier>");
    expect(await runCli(["market", "pack", "hello@0.1.0"], t.io)).toBe(1);
    expect(t.err.at(-1)).toBe("Le démon Kibo ne tourne pas : lance l'application Kibo, puis réessaie.");
    expect(await runCli(["market", "keygen"], t.io)).toBe(1);
    expect(t.err.at(-1)).toStartWith("Erreur INVALID_INPUT");
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

  test("new --template writes the template manifest and refuses an unknown one", async () => {
    const t = io();
    expect(await runCli(["component", "new", "cube", "--template", "3d"], t.io)).toBe(0);
    const manifest = JSON.parse(
      readFileSync(join(t.home, "components", "src", "cube", "kibo.component.json"), "utf8"),
    );
    expect(manifest.capabilities).toEqual(["webgl", "assets"]);
    expect(await runCli(["component", "new", "other", "--template", "bogus"], t.io)).toBe(1);
    expect(t.err).toEqual(["Erreur INVALID_INPUT : unknown template bogus"]);
    expect(existsSync(join(t.home, "components", "src", "other"))).toBe(false);
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
      integrations: { testOrigins: [], memorySecrets: true },
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
    const kpkg = join(t.home, "hello.kpkg");
    expect(await runCli(["market", "pack", "hello@0.1.0", "--out", kpkg, "--publisher", "Adam"], t.io)).toBe(
      0,
    );
    expect(t.out.at(-1)).toBe(`Paquet écrit dans ${kpkg}`);
    expect(decodeKpkg(new Uint8Array(readFileSync(kpkg))).publisher.name).toBe("Adam");
    expect(await runCli(["component", "publish", "hello", "--to", "equipe"], t.io)).toBe(1);
    expect(t.err.at(-1)).toStartWith("Erreur SYNC_OFFLINE");
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
