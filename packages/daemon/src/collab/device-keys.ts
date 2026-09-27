import { KiboError, SECRET_SYNC_DEVICE } from "@kibo/schema";
import { generateKeyPair, type KeyPair } from "@kibo/trust";
import { z } from "zod";
import type { SecretStore } from "../integrations/types";

const Stored = z.object({ publicKey: z.string().min(1), privateKey: z.string().min(1) });

function parseStored(raw: string): KeyPair {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new KiboError("UNAUTHORIZED", "device key in the secret store is not JSON");
  }
  const parsed = Stored.safeParse(json);
  if (!parsed.success) throw new KiboError("UNAUTHORIZED", "device key in the secret store is malformed");
  return parsed.data;
}

export async function createDeviceKeys(secrets: SecretStore): Promise<KeyPair> {
  const keys = await generateKeyPair();
  await secrets.set(SECRET_SYNC_DEVICE, JSON.stringify(keys));
  return keys;
}

export async function loadDeviceKeys(secrets: SecretStore): Promise<KeyPair> {
  const raw = await secrets.get(SECRET_SYNC_DEVICE);
  if (raw === null) throw new KiboError("UNAUTHORIZED", "device key is missing from the secret store");
  return parseStored(raw);
}

export async function clearDeviceKeys(secrets: SecretStore): Promise<void> {
  await secrets.delete(SECRET_SYNC_DEVICE);
}
