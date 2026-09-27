import { join } from "node:path";
import { ComponentManifest, KiboError } from "@kibo/schema";
import { connectDaemon, type DaemonClient, daemonInfoFile } from "../daemon-client";
import { fr } from "../fr";
import type { CliIo } from "../index";
import { componentDir } from "./test";

export type PublishStrategy = "update-all" | "new-version";

function connectionMessage(e: unknown, io: CliIo): string | null {
  if (!(e instanceof KiboError)) return null;
  if (e.code === "UNAUTHORIZED") return fr.pairingFailed;
  if (e.code === "NOT_FOUND") return fr.noDaemon;
  if (e.code === "STORE_CORRUPT") return fr.daemonInfoCorrupt(daemonInfoFile(io.home));
  return null;
}

export async function connectOrExplain(io: CliIo): Promise<DaemonClient | null> {
  try {
    return await connectDaemon(io.home);
  } catch (e) {
    const message = connectionMessage(e, io);
    if (message === null) throw e;
    io.err(message);
    return null;
  }
}

export async function publishCommand(
  id: string,
  strategy: PublishStrategy | null,
  io: CliIo,
): Promise<number> {
  const client = await connectOrExplain(io);
  if (!client) return 1;
  const preview = await client.rpc({ method: "previewPublish", id });
  if (preview.status === "unchanged") {
    io.out(fr.unchanged);
    return 0;
  }
  if (!preview.validation.ok) {
    io.err(fr.invalid);
    return 1;
  }
  if (preview.usages.length > 0 && strategy === null) {
    io.err(fr.strategyRequired(preview.usages.length));
    return 1;
  }
  const r = await client.rpc({ method: "publishComponent", id, strategy: strategy ?? "new-version" });
  io.out(fr.published(r.version.version));
  if (r.needsApproval) io.out(fr.needsApproval);
  if (r.failed.length > 0) {
    io.out(fr.partial(r.failed.length));
    for (const f of r.failed) io.out(fr.failedLine(f.projectName, f.pageTitle, f.message));
  }
  return 0;
}

async function manifestRef(target: string, io: CliIo): Promise<{ id: string; version: string }> {
  const file = join(componentDir(target, io), "kibo.component.json");
  let json: unknown;
  try {
    json = JSON.parse(await Bun.file(file).text());
  } catch {
    throw new KiboError("NOT_FOUND", `${file} is missing or unreadable`);
  }
  const parsed = ComponentManifest.safeParse(json);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `${file} is not a component manifest`);
  return { id: parsed.data.id, version: parsed.data.version };
}

export async function marketPublishCommand(
  target: string,
  sourceId: string,
  publisherName: string | null,
  io: CliIo,
): Promise<number> {
  const { id, version } = await manifestRef(target, io);
  const client = await connectOrExplain(io);
  if (!client) return 1;
  const r = await client.rpc({
    method: "publishToMarket",
    id,
    version,
    sourceId,
    ...(publisherName ? { publisherName } : {}),
  });
  io.out(fr.marketPublished(sourceId, r.serial));
  return 0;
}
