import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
      out: (l: string) => out.push(l),
      err: (l: string) => err.push(l),
    },
  };
}

describe("kibo", () => {
  test("usage on unknown commands, component commands included", async () => {
    const t = io();
    expect(await runCli(["nope"], t.io)).toBe(2);
    expect(t.err.join("\n")).toContain("kibo tickets list");
    for (const command of ["new", "test", "dev"]) {
      expect(await runCli(["component", command, "x"], t.io)).toBe(2);
    }
    expect(t.err.join("\n")).not.toContain("kibo component");
    expect(t.err.join("\n")).not.toContain("kibo market");
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
});
