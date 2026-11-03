import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectCommand, ProjectSnapshot, RpcRequest, RpcResult } from "@kibo/schema";
import { z } from "zod";
import { type Daemon, type DaemonOptions, startDaemon } from "../daemon";
import { questionImagesDir } from "../questions/question-images";

const Answer = z.object({ ok: z.boolean(), result: z.unknown(), error: z.unknown().optional() });
const Created = z.object({ id: z.string() });
const ADAM = { kind: "human", ref: "adam" } as const;

export type TypedRpc = <M extends RpcRequest["method"]>(
  req: Extract<RpcRequest, { method: M }>,
) => Promise<RpcResult[M]>;

export const looseRpc = (handle: (req: RpcRequest) => Promise<unknown>): TypedRpc => handle as TypedRpc;

export type LaunchedDaemon = {
  home: string;
  daemon: Daemon;
  rpc: TypedRpc;
  call(req: RpcRequest): Promise<{ ok: boolean; result?: unknown; error?: unknown }>;
};

export type SeededSilo = {
  projectId: string;
  folder: string;
  openQuestion: string;
  openImage: string;
  archivedQuestion: string;
  images: ReadonlyMap<string, string>;
};

const cleanups: (() => Promise<void> | void)[] = [];

export async function cleanLaunched(): Promise<void> {
  for (const clean of cleanups.splice(0).reverse()) await clean();
}

export function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

export async function launchDaemon(extra: Partial<DaemonOptions> = {}): Promise<LaunchedDaemon> {
  const home = tempDir("kibo-remote-daemon-");
  const daemon = await startDaemon({
    port: 0,
    sandboxPort: 0,
    uiDir: null,
    dev: false,
    user: "adam",
    home,
    integrations: { testOrigins: [], memorySecrets: true },
    ...extra,
  });
  cleanups.push(() => daemon.stop());
  const headers = { "content-type": "application/json", origin: daemon.url };
  const paired = await fetch(`${daemon.url}/api/pair`, {
    method: "POST",
    headers,
    body: JSON.stringify({ token: daemon.token }),
  });
  const cookie = paired.headers.get("set-cookie")?.split(";")[0] ?? "";
  const call = async (req: RpcRequest) => {
    const res = await fetch(`${daemon.url}/api/rpc`, {
      method: "POST",
      headers: { ...headers, cookie },
      body: JSON.stringify(req),
    });
    return Answer.parse(await res.json());
  };
  const rpc: TypedRpc = async (req) => {
    const answer = await call(req);
    if (!answer.ok) throw new Error(`rpc ${req.method} failed: ${JSON.stringify(answer.error)}`);
    return answer.result as RpcResult[typeof req.method];
  };
  return { home, daemon, rpc, call };
}

const imageMeta = (id: string) => ({ id, name: "maquette.png", bytes: 3, width: null, height: null });

export async function seedSilo(launched: LaunchedDaemon, name = "Silo", key = "SILO"): Promise<SeededSilo> {
  const { rpc, home } = launched;
  const folder = tempDir("kibo-remote-silo-");
  const projectId = (await rpc({ method: "createProject", name, key, folder, color: "#F97316" })).id;
  const command = async (cmd: ProjectCommand) =>
    Created.parse(await rpc({ method: "command", projectId, command: cmd }));
  const ticketId = (await command({ method: "createTicket", title: "Quotas de stockage" })).id;
  const ask = async (title: string) =>
    (await command({ method: "createQuestion", ticketId, title, createdBy: ADAM })).id;
  const openQuestion = await ask("Quota par client : 2 Go ou 5 Go ?");
  const archivedQuestion = await ask("Rétention des sauvegardes ?");
  const images = new Map([
    [openQuestion, crypto.randomUUID()],
    [archivedQuestion, crypto.randomUUID()],
  ]);
  for (const [questionId, imageId] of images) {
    const dir = questionImagesDir(home, questionId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${imageId}.png`), "png");
  }
  await rpc({
    method: "command",
    projectId,
    command: { method: "archiveQuestion", questionId: archivedQuestion, by: ADAM },
  });
  return {
    projectId,
    folder,
    openQuestion,
    openImage: images.get(openQuestion) ?? "",
    archivedQuestion,
    images,
  };
}

const withImages = (snapshot: ProjectSnapshot, images: ReadonlyMap<string, string>): ProjectSnapshot => ({
  ...snapshot,
  questions: snapshot.questions.map((q) => {
    const imageId = images.get(q.id);
    return imageId ? { ...q, images: [imageMeta(imageId)] } : q;
  }),
});

export const withSeededImages =
  (silo: SeededSilo) =>
  (rpc: TypedRpc): TypedRpc =>
  async (req) => {
    const result = await rpc(req);
    if (req.method !== "getProject") return result;
    return withImages(result as ProjectSnapshot, silo.images) as RpcResult[typeof req.method];
  };
