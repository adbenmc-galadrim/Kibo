import { KiboError } from "@kibo/schema";
import { connectDaemon, type DaemonClient, daemonInfoFile } from "../daemon-client";
import { fr } from "../fr";
import type { CliIo } from "../index";

export type PublishStrategy = "update-all" | "new-version";

function connectionMessage(e: unknown, io: CliIo): string | null {
  if (!(e instanceof KiboError)) return null;
  if (e.code === "UNAUTHORIZED") return fr.pairingFailed;
  if (e.code === "NOT_FOUND") return fr.noDaemon;
  if (e.code === "STORE_CORRUPT") return fr.daemonInfoCorrupt(daemonInfoFile(io.home));
  return null;
}

async function connect(io: CliIo): Promise<DaemonClient | null> {
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
  const client = await connect(io);
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
