import { readFileSync, writeFileSync } from "node:fs";
import { ComponentId, KiboError, Kpkg, SemVer, splitRef } from "@kibo/schema";
import { encodeKpkg, formatFingerprint, generateKeyPair, keyFingerprint } from "@kibo/trust";
import { z } from "zod";
import type { Parsed } from "../args";
import { fr } from "../fr";
import { buildStaticIndex } from "../market-index-builder";

export type MarketDaemon = {
  exportKpkg(input: { id: string; version: string; publisherName?: string }): Promise<Kpkg>;
};
export type MarketCliDeps = {
  daemon(): Promise<MarketDaemon | null>;
  out(line: string): void;
  err(line: string): void;
  now(): Date;
};
type Flags = Parsed["flags"];

const KeyFile = z.object({ publicKey: z.string().min(1), privateKey: z.string().min(1) });

const text = (flags: Flags, name: string): string | null => {
  const v = flags[name];
  return typeof v === "string" ? v : null;
};

const required = (flags: Flags, name: string): string => {
  const v = text(flags, name);
  if (v === null) throw new KiboError("INVALID_INPUT", `--${name} is required`);
  return v;
};

const isFileExists = (e: unknown): boolean => e instanceof Error && "code" in e && e.code === "EEXIST";

async function keygen(flags: Flags, deps: MarketCliDeps): Promise<number> {
  const file = required(flags, "out");
  const keys = await generateKeyPair();
  try {
    writeFileSync(file, `${JSON.stringify(keys)}\n`, { mode: 0o600, flag: "wx" });
  } catch (e) {
    if (isFileExists(e)) throw new KiboError("INVALID_INPUT", `${file} already exists`);
    throw e;
  }
  deps.out(fr.keyWritten(file, formatFingerprint(await keyFingerprint(keys.publicKey))));
  return 0;
}

function parseRef(ref: string | undefined): { id: string; version: string } {
  if (!ref) throw new KiboError("INVALID_INPUT", "expected <id>@<version>");
  const { id, version } = splitRef(ref);
  if (!ComponentId.safeParse(id).success || !SemVer.safeParse(version).success)
    throw new KiboError("INVALID_INPUT", `invalid component ref ${ref}`);
  return { id, version };
}

async function pack(ref: string | undefined, flags: Flags, deps: MarketCliDeps): Promise<number> {
  const { id, version } = parseRef(ref);
  const daemon = await deps.daemon();
  if (!daemon) return 1;
  const publisherName = text(flags, "publisher");
  const exported = Kpkg.safeParse(
    await daemon.exportKpkg({ id, version, ...(publisherName ? { publisherName } : {}) }),
  );
  if (!exported.success) throw new KiboError("INTERNAL", "the daemon answered an invalid package");
  const pkg = exported.data;
  const file = text(flags, "out") ?? `${id}-${version}.kpkg`;
  writeFileSync(file, encodeKpkg(pkg), { mode: 0o644 });
  deps.out(fr.packWritten(file));
  return 0;
}

function readKeyFile(file: string): z.infer<typeof KeyFile> {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new KiboError("INVALID_INPUT", `${file} is not a key file`);
  }
  const parsed = KeyFile.safeParse(json);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `${file} is not a key file`);
  return parsed.data;
}

async function index(flags: Flags, deps: MarketCliDeps): Promise<number> {
  const verify = text(flags, "verify");
  const result = await buildStaticIndex({
    dir: required(flags, "dir"),
    keys: readKeyFile(required(flags, "key")),
    id: required(flags, "id"),
    name: required(flags, "name"),
    verified: verify ? verify.split(",").filter((k) => k.length > 0) : [],
    now: deps.now(),
  });
  deps.out(fr.indexSigned(result.serial, result.packages));
  return 0;
}

export async function runMarketCommand(argv: string[], flags: Flags, deps: MarketCliDeps): Promise<number> {
  const [command, target] = argv;
  if (command === "keygen") return keygen(flags, deps);
  if (command === "pack") return pack(target, flags, deps);
  if (command === "index") return index(flags, deps);
  deps.err(fr.marketUsage);
  return 2;
}
