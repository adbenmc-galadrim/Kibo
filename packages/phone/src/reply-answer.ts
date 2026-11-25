import { openReply, type RemoteKeys, type SealedRequest } from "@kibo/remote";
import { KiboError } from "@kibo/schema";
import type { z } from "zod";

const decoder = new TextDecoder();

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new KiboError("REMOTE_REJECTED", "reply is not json");
  }
}

export async function openAnswer<T>(
  keys: RemoteKeys,
  reply: SealedRequest,
  schema: z.ZodType<T>,
): Promise<T> {
  const parsed = schema.safeParse(parseJson(decoder.decode(await openReply(keys, reply))));
  if (!parsed.success) throw new KiboError("REMOTE_REJECTED", "reply is not an rpc answer");
  return parsed.data;
}
