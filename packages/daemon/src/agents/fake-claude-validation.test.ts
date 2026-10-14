import { expect, test } from "bun:test";
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { ASK_TOOL, askInputFromTool } from "@kibo/schema";
import { imageSize } from "../questions/image-size";
import { cleanFakeDirs, finish, readHooks, settings, tmp } from "./fake-claude.test-helper";
import { resolveStepInput } from "./fake-claude-ai";
import { FAKE_CLAUDE, scenarioPath } from "./fake-claude-scenario";

cleanFakeDirs();

const play = (cwd: string, args: string[], env: Record<string, string>, prompt: string) =>
  Bun.spawn([FAKE_CLAUDE, "-p", "--output-format", "stream-json", "--verbose", ...args], {
    cwd,
    env: { ...process.env, ...env },
    stdin: new TextEncoder().encode(prompt),
    stdout: "pipe",
    stderr: "pipe",
  });

test("image paths of a step may start from the folder of the run", () => {
  expect(resolveStepInput({ images: ["$CWD/shots/1.png", "/abs/2.png", 3] }, {}, "/w")).toEqual({
    images: ["/w/shots/1.png", "/abs/2.png", 3],
  });
  expect(resolveStepInput({ question: "x" }, {}, "/w")).toEqual({ question: "x" });
});

test("the delivery-validation scenario writes a real PNG then asks to validate it", async () => {
  const state = tmp();
  const cwd = realpathSync(tmp());
  const log = join(state, "hooks.jsonl");
  const env = {
    KIBO_FAKE_CLAUDE_SCENARIO: scenarioPath("delivery-validation"),
    KIBO_FAKE_CLAUDE_STATE: state,
  };
  const args = ["--session-id", "s1", "--settings", settings(log)];
  const first = await finish(play(cwd, args, env, "Livre EMIS-15."));
  expect(first.code).toBe(0);
  const shot = join(cwd, "shots/1-no-access.png");
  expect(imageSize(readFileSync(shot))).toEqual({ width: 1, height: 1 });
  const asked = readHooks(log).filter((h) => h.hook_event_name === "PostToolUse" && h.tool_name === ASK_TOOL);
  expect(asked).toHaveLength(1);
  const input = asked[0]?.tool_input;
  const ask = askInputFromTool(typeof input === "object" && input !== null ? { ...input } : null, true);
  expect(ask).toMatchObject({ kind: "validation", images: [shot] });
  const resumed = ["--resume", "s1", "--settings", settings(log)];
  const second = await finish(play(cwd, resumed, env, "Réponse à ta question : Valider"));
  expect(second.code).toBe(0);
  expect(second.lines.at(-1)).toMatchObject({ type: "result", result: "Écran 1.2 validé." });
});
