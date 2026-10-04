import { KiboError } from "@kibo/schema";
import type { z } from "zod";
import type { IntegrationResponse } from "../../integrations/types";

type Redact = (text: string) => string;
const decoder = new TextDecoder();

export function remoteError(provider: string, status: number, body: string, redact: Redact): KiboError {
  const detail = redact(body).slice(0, 200);
  if (status === 401 || status === 403)
    return new KiboError("REMOTE_REJECTED", `${provider} ${status}: ${detail}`);
  if (status === 404) return new KiboError("REMOTE_NOT_FOUND", `${provider} 404: ${detail}`);
  if (status === 429) return new KiboError("RATE_LIMITED", `${provider} rate limit`);
  return new KiboError("REMOTE_UNAVAILABLE", `${provider} ${status}: ${detail}`);
}

function json(text: string, provider: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new KiboError("REMOTE_REJECTED", `${provider} answered with invalid json`);
  }
}

export function parseRemote<T>(
  provider: string,
  res: IntegrationResponse,
  schema: z.ZodType<T>,
  redact: Redact,
): T {
  const text = decoder.decode(res.body);
  if (res.status < 200 || res.status >= 300) throw remoteError(provider, res.status, text, redact);
  const parsed = schema.safeParse(json(text, provider));
  if (!parsed.success)
    throw new KiboError(
      "REMOTE_REJECTED",
      `unexpected ${provider} response: ${parsed.error.issues[0]?.message ?? ""}`,
    );
  return parsed.data;
}
