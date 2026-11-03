import { KiboError } from "@kibo/schema";
import { z } from "zod";

const Registered = z.object({ accountId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/) });

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

const REGISTER_TIMEOUT_MS = 10_000;

function refusal(status: number): KiboError {
  if (status === 403) return new KiboError("REMOTE_REJECTED", "Code d'installation refusé par le serveur");
  if (status === 429) return new KiboError("RATE_LIMITED", "Trop d'essais · réessaie dans quelques minutes");
  return new KiboError("REMOTE_UNAVAILABLE", `Le serveur a répondu ${status} · réessaie plus tard`);
}

export async function registerMac(
  fetchFn: Fetch,
  input: { serverUrl: string; setupCode: string; macToken: string },
): Promise<{ accountId: string }> {
  let res: Response;
  try {
    res = await fetchFn(`${input.serverUrl.replace(/\/+$/, "")}/api/mac/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ setupCode: input.setupCode, macToken: input.macToken }),
      signal: AbortSignal.timeout(REGISTER_TIMEOUT_MS),
    });
  } catch {
    throw new KiboError("REMOTE_UNAVAILABLE", "Serveur injoignable · vérifie l'adresse et réessaie");
  }
  if (res.status !== 200) throw refusal(res.status);
  const parsed = Registered.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new KiboError("REMOTE_REJECTED", "Réponse du serveur illisible");
  return parsed.data;
}
