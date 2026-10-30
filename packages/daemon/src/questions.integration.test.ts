import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import type { ProjectCommand, ProjectEventPage, RpcRequest } from "@kibo/schema";
import { z } from "zod";
import { startDaemon } from "./daemon";
import { questionImagesDir } from "./questions/question-images";

const Answer = z.object({ ok: z.boolean(), result: z.unknown() });
const Created = z.object({ id: z.string() });
const Numbered = z.object({ id: z.string(), number: z.number().nullable() });
const Snapshot = z.object({ questions: z.array(z.object({ id: z.string() })) });
const ADAM = { kind: "human", ref: "adam" } as const;
const QUOTA = "Quota par client : 2 Go ou 5 Go ?";

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const clean of cleanups.splice(0).reverse()) await clean();
});

async function launch() {
  const home = mkdtempSync(join(tmpdir(), "kibo-questions-"));
  cleanups.push(() => rmSync(home, { recursive: true, force: true }));
  const daemon = await startDaemon({
    port: 0,
    sandboxPort: 0,
    uiDir: null,
    dev: false,
    toolchain: DEV_TOOLCHAIN,
    user: "adam",
    home,
  });
  cleanups.push(() => daemon.stop());
  const headers = { "content-type": "application/json", origin: daemon.url };
  const paired = await fetch(`${daemon.url}/api/pair`, {
    method: "POST",
    headers,
    body: JSON.stringify({ token: daemon.token }),
  });
  const cookie = paired.headers.get("set-cookie")?.split(";")[0] ?? "";
  const rpc = async (req: RpcRequest): Promise<unknown> => {
    const res = await fetch(`${daemon.url}/api/rpc`, {
      method: "POST",
      headers: { ...headers, cookie },
      body: JSON.stringify(req),
    });
    const answer = Answer.parse(await res.json());
    if (!answer.ok) throw new Error(`rpc ${req.method} failed: ${JSON.stringify(answer)}`);
    return answer.result;
  };
  return { home, rpc };
}

test("a removed question leaves the project, the journal says so, its images go and its number is kept", async () => {
  const { home, rpc } = await launch();
  const projectId = Created.parse(
    await rpc({ method: "createProject", name: "Silo", key: "SILO", folder: null, color: "#F97316" }),
  ).id;
  const command = (cmd: ProjectCommand) => rpc({ method: "command", projectId, command: cmd });
  const ticketId = Created.parse(await command({ method: "createTicket", title: "Quotas de stockage" })).id;
  const ask = async () =>
    Numbered.parse(await command({ method: "createQuestion", ticketId, title: QUOTA, createdBy: ADAM }));
  const events = async () =>
    ((await rpc({ method: "listProjectEvents", projectId, ticketId, limit: 50 })) as ProjectEventPage).items;

  const first = await ask();
  expect(first.number).toBe(1);
  await command({
    method: "answerQuestion",
    questionId: first.id,
    answer: { kind: "text", text: "5 Go" },
    by: ADAM,
  });
  expect((await events()).map((e) => e.kind)).toContain("question_answered");

  const images = questionImagesDir(home, first.id);
  mkdirSync(images, { recursive: true });
  writeFileSync(join(images, "1.png"), "png");
  await command({ method: "removeQuestion", questionId: first.id });
  const snapshot = Snapshot.parse(await rpc({ method: "getProject", projectId }));
  expect(snapshot.questions.map((q) => q.id)).not.toContain(first.id);
  expect((await events())[0]).toMatchObject({
    kind: "question_deleted",
    source: "user",
    data: { questionId: first.id, title: QUOTA, ref: QUOTA },
  });
  expect(existsSync(images)).toBe(false);

  expect((await ask()).number).toBe(2);
});
