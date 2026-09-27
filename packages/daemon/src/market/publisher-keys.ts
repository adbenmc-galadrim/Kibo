import { KiboError, SECRET_MARKET_PUBLISHER } from "@kibo/schema";
import { generateKeyPair, type KeyPair } from "@kibo/trust";
import { z } from "zod";
import type { SecretStore } from "../integrations/types";

export type PublisherKeys = KeyPair & { name: string };

const PublisherName = z.string().trim().min(1).max(64);
const Stored = z.object({ name: PublisherName, publicKey: z.string().min(1), privateKey: z.string().min(1) });

function parseStored(raw: string): PublisherKeys {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new KiboError("INTERNAL", "stored publisher key is not JSON");
  }
  const parsed = Stored.safeParse(json);
  if (!parsed.success) throw new KiboError("INTERNAL", "stored publisher key is unreadable");
  return parsed.data;
}

const pending = new WeakMap<SecretStore, Promise<unknown>>();

function serialized<T>(secrets: SecretStore, task: () => Promise<T>): Promise<T> {
  const run = (pending.get(secrets) ?? Promise.resolve()).then(task);
  const settled = run.catch(() => undefined);
  pending.set(secrets, settled);
  return run;
}

export function loadPublisherKeys(secrets: SecretStore, name?: string): Promise<PublisherKeys> {
  return serialized(secrets, () => loadOrCreate(secrets, name));
}

async function loadOrCreate(secrets: SecretStore, name?: string): Promise<PublisherKeys> {
  const raw = await secrets.get(SECRET_MARKET_PUBLISHER);
  if (raw !== null) return parseStored(raw);
  const parsed = PublisherName.safeParse(name ?? "");
  if (!parsed.success) throw new KiboError("INVALID_INPUT", "a publisher name is required the first time");
  const created: PublisherKeys = { name: parsed.data, ...(await generateKeyPair()) };
  await secrets.set(SECRET_MARKET_PUBLISHER, JSON.stringify(created));
  return created;
}
