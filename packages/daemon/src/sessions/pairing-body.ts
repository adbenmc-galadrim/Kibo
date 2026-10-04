import { z } from "zod";
import { parseJson, readBounded } from "../read-bounded";

export const MAX_PAIRING_BYTES = 4096;

const JsonObject = z.record(z.string(), z.unknown());

export type PairingField = { tooLarge: true } | { tooLarge: false; value: string | null };

export async function readPairingField(req: Request, field: "token" | "code"): Promise<PairingField> {
  const text = await readBounded(req, MAX_PAIRING_BYTES);
  if (text === null) return { tooLarge: true };
  const parsed = JsonObject.safeParse(parseJson(text));
  const value = parsed.success ? parsed.data[field] : null;
  return { tooLarge: false, value: typeof value === "string" ? value : null };
}
