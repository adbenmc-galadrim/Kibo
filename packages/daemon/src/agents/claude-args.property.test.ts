import { expect, test } from "bun:test";
import { EMPTY_DELIVERY, isSafeAddDir, KiboError } from "@kibo/schema";
import fc from "fast-check";
import { addDirsOf } from "./add-dirs";
import { claudeArgs } from "./claude-args";
import { NO_AGENT_FLAGS } from "./cli-flags";

const HOME = "/Users/a";
const segment = fc.constantFrom("..", ".", ".kibo", ".SSH", ".claude", ".Config", "skills", "a", "");
const path = fc
  .array(segment, { maxLength: 4 })
  .chain((parts) => fc.constantFrom(`/${parts.join("/")}`, `${HOME}/${parts.join("/")}`, parts.join("/")));
const extraArg = fc.oneof(path, fc.constantFrom("--tools", "", "--add-dir", "--model", "x"));

function launchLine(
  agent: string[],
  project: string[],
  extraArgs: string[],
  withFlags: boolean,
  resume: boolean,
) {
  const io = { home: HOME, realpath: (p: string) => p, log: () => undefined };
  const addDirs = addDirsOf({ addDirs: agent }, { ...EMPTY_DELIVERY, addDirs: project }, io);
  return claudeArgs({
    model: "opus",
    permissionFlag: null,
    extraArgs,
    systemPromptFile: "/r/CLAUDE.md",
    hook: { command: "/k/kibo-hook", args: [] },
    allow: [],
    deny: [],
    mcpConfigFile: null,
    mcpTools: null,
    addDirs,
    sessionId: "s1",
    resume,
    agentFlags: withFlags ? NO_AGENT_FLAGS : undefined,
  });
}

test("whatever the folders and task arguments, every value after --add-dir is a safe folder", () => {
  fc.assert(
    fc.property(
      fc.array(path, { maxLength: 5 }),
      fc.array(path, { maxLength: 5 }),
      fc.array(extraArg, { maxLength: 4 }),
      fc.boolean(),
      fc.boolean(),
      (agent, project, extra, withFlags, resume) => {
        let args: string[];
        try {
          args = launchLine(agent, project, extra, withFlags, resume);
        } catch (e) {
          expect(e).toBeInstanceOf(KiboError);
          return;
        }
        args.forEach((arg, at) => {
          if (arg !== "--add-dir") return;
          const rest = args.slice(at + 1);
          const end = rest.findIndex((a) => a.startsWith("-"));
          const values = end === -1 ? rest : rest.slice(0, end);
          expect(values.length).toBeGreaterThan(0);
          expect(values.every((v) => isSafeAddDir(v, HOME))).toBe(true);
        });
      },
    ),
  );
});
