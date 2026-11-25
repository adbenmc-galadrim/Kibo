import { Sealed, SealedRequest, SnapshotHeader } from "@kibo/remote";
import { KIBO_ERROR_CODES, KiboError } from "@kibo/schema";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import { z } from "zod";
import { CreationOptions, RequestOptions } from "./webauthn-json";

export type Pairing = { accountId: string; pairToken: string };

export type ServerApi = {
  session(): Promise<boolean>;
  pairOptions(pairing: Pairing): Promise<PublicKeyCredentialCreationOptionsJSON>;
  pairVerify(pairing: Pairing & { response: RegistrationResponseJSON }): Promise<void>;
  loginOptions(): Promise<PublicKeyCredentialRequestOptionsJSON>;
  loginVerify(response: AuthenticationResponseJSON): Promise<void>;
  logout(): Promise<void>;
  snapshotHeaders(projectId: string): Promise<SnapshotHeader[]>;
  snapshot(projectId: string, kind: string): Promise<Sealed | null>;
  request(sealed: SealedRequest): Promise<SealedRequest>;
  eventsUrl(): string;
};

type ServerApiOptions = { baseUrl: string; fetch?: typeof fetch };

const Failure = z.object({ error: z.object({ code: z.enum(KIBO_ERROR_CODES), message: z.string() }) });
const Relayed = z.object({ sealed: SealedRequest });

async function failureOf(res: Response): Promise<KiboError> {
  const parsed = Failure.safeParse(await res.json().catch(() => null));
  if (parsed.success) return new KiboError(parsed.data.error.code, parsed.data.error.message);
  return new KiboError(res.status === 401 ? "UNAUTHORIZED" : "INTERNAL", `server answered ${res.status}`);
}

export function createServerApi({ baseUrl, fetch: f = fetch }: ServerApiOptions): ServerApi {
  const send = async (path: string, init?: RequestInit): Promise<Response> => {
    try {
      return await f(`${baseUrl}/api/phone/${path}`, { credentials: "same-origin", ...init });
    } catch (e) {
      throw new KiboError("REMOTE_UNAVAILABLE", `server unreachable: ${e instanceof Error ? e.message : e}`);
    }
  };
  const json = async (path: string, init?: RequestInit): Promise<unknown> => {
    const res = await send(path, init);
    if (!res.ok) throw await failureOf(res);
    return res.json();
  };
  const post = (path: string, body: unknown) =>
    json(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const query = (params: Record<string, string>) => new URLSearchParams(params).toString();

  return {
    async session() {
      const res = await send("session");
      if (res.status === 401) return false;
      if (!res.ok) throw await failureOf(res);
      return true;
    },
    pairOptions: async (pairing) => CreationOptions.parse(await post("pair/options", pairing)),
    pairVerify: async (input) => {
      await post("pair/verify", input);
    },
    loginOptions: async () => RequestOptions.parse(await post("login/options", {})),
    loginVerify: async (response) => {
      await post("login/verify", { response });
    },
    logout: async () => {
      await post("logout", {});
    },
    snapshotHeaders: async (projectId) =>
      z.array(SnapshotHeader).parse(await json(`snapshot-headers?${query({ projectId })}`)),
    async snapshot(projectId, kind) {
      const res = await send(`snapshot?${query({ projectId, kind })}`);
      if (res.status === 404) return null;
      if (!res.ok) throw await failureOf(res);
      return Sealed.parse(await res.json());
    },
    request: async (sealed) => Relayed.parse(await post("request", { sealed })).sealed,
    eventsUrl() {
      const url = new URL("/api/phone/events", baseUrl || globalThis.location.href);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      return url.toString();
    },
  };
}
