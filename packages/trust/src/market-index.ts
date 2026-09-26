import { KiboError, MarketIndex } from "@kibo/schema";
import { utf8 } from "./bytes";
import { signBytes, verifyBytes } from "./ed25519";

export async function signIndex(
  index: MarketIndex,
  privateKey: string,
): Promise<{ bytes: Uint8Array; sig: string }> {
  const bytes = utf8(JSON.stringify(MarketIndex.parse(index)));
  return { bytes, sig: await signBytes(privateKey, bytes) };
}

function parseIndex(bytes: Uint8Array): MarketIndex {
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (e) {
    throw new KiboError("INVALID_INPUT", `index is not UTF-8 JSON: ${String(e)}`);
  }
  const parsed = MarketIndex.safeParse(json);
  if (!parsed.success) {
    throw new KiboError("INVALID_INPUT", `index does not match the format: ${parsed.error.message}`);
  }
  return parsed.data;
}

export async function verifyIndex(input: {
  bytes: Uint8Array;
  sig: string;
  expectedKey: string;
  lastSerial: number | null;
}): Promise<MarketIndex> {
  if (!(await verifyBytes(input.expectedKey, input.bytes, input.sig))) {
    throw new KiboError("SIGNATURE_INVALID", "index signature does not match the source key");
  }
  const index = parseIndex(input.bytes);
  if (index.source.publicKey !== input.expectedKey) {
    throw new KiboError("SIGNATURE_INVALID", "index declares another source key");
  }
  if (input.lastSerial !== null && index.serial < input.lastSerial) {
    throw new KiboError("INDEX_ROLLBACK", `index serial ${index.serial} is lower than ${input.lastSerial}`);
  }
  return index;
}
