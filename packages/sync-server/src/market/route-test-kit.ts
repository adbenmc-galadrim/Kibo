import {
  generateKeyPair,
  HTTP_SIGNATURE_HEADERS,
  httpSigningPayload,
  type KeyPair,
  owned,
  PUBLISHER_CLAIM_HEADER,
  sha256Hex,
  signBytes,
  signRequest,
} from "@kibo/trust";
import { makeTestPackage, type TestPackageInput } from "@kibo/trust/testing";
import { createMarketLimits } from "./market-limits";
import { claimFor, KIT_NOW, MarketKit } from "./market-test-kit";
import { handleMarketRoute, type MarketRouteDeps } from "./routes";
import { NONCE_TTL_MS, NonceCache } from "./signed-request";

export const BASE = "https://sync.kibo.test";
export const PUBLISH = "/v1/market/packages";
export const REVOKE = "/v1/market/revoke";

export type SignOptions = {
  at?: number;
  method?: string;
  signedPath?: string;
  signedBody?: Uint8Array;
  sentBody?: BodyInit;
  headers?: Record<string, string>;
};

export const errorOf = async (res: Response | null) =>
  ((await res?.json()) as { error?: { code: string; message: string } }).error;
export const codeOf = async (res: Response | null) => (await errorOf(res))?.code;
export const json = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

export class RouteKit {
  now = KIT_NOW;
  deps: MarketRouteDeps;

  private constructor(
    readonly kit: MarketKit,
    readonly device: { userId: string; deviceId: string; keys: KeyPair },
    readonly publisher: KeyPair,
    readonly claim: string,
  ) {
    this.deps = this.freshDeps();
  }

  static async create(prefix: string): Promise<RouteKit> {
    const kit = await MarketKit.create(prefix);
    const device = await kit.user("Léa");
    kit.market.grant(device.userId, "publisher");
    const publisher = await generateKeyPair();
    return new RouteKit(kit, device, publisher, await claimFor(publisher, device.userId));
  }

  restart(): void {
    this.deps = this.freshDeps();
  }

  pkg(input: TestPackageInput = {}) {
    return makeTestPackage({ keys: this.publisher, ...input });
  }

  async signed(path: string, body: Uint8Array, opts: SignOptions = {}): Promise<Request> {
    const auth = await signRequest({
      deviceId: this.device.deviceId,
      privateKey: this.device.keys.privateKey,
      method: opts.method ?? "POST",
      path: opts.signedPath ?? path,
      body: opts.signedBody ?? body,
      now: opts.at ?? this.now,
    });
    const headers = { ...auth, [PUBLISHER_CLAIM_HEADER]: this.claim, ...opts.headers };
    return new Request(`${BASE}${path}`, { method: "POST", headers, body: opts.sentBody ?? owned(body) });
  }

  async signedRaw(body: Uint8Array, input: { nonce: string; method?: string }): Promise<Request> {
    const date = String(this.now);
    const payload = httpSigningPayload({
      method: input.method ?? "POST",
      path: PUBLISH,
      date,
      nonce: input.nonce,
      bodySha256: await sha256Hex(body),
    });
    const h = HTTP_SIGNATURE_HEADERS;
    const headers = {
      [h.device]: this.device.deviceId,
      [h.date]: date,
      [h.nonce]: input.nonce,
      [h.signature]: await signBytes(this.device.keys.privateKey, payload),
      [PUBLISHER_CLAIM_HEADER]: this.claim,
    };
    return new Request(`${BASE}${PUBLISH}`, { method: "POST", headers, body: owned(body) });
  }

  route(req: Request): Promise<Response | null> {
    return handleMarketRoute(req, new URL(req.url), this.deps);
  }

  get(path: string, headers: Record<string, string> = {}): Promise<Response | null> {
    return this.route(new Request(`${BASE}${path}`, { headers }));
  }

  close(): void {
    this.kit.close();
  }

  private freshDeps(): MarketRouteDeps {
    const clock = () => this.now;
    return {
      sdb: this.kit.sdb,
      market: this.kit.market,
      nonces: new NonceCache({ sdb: this.kit.sdb, ttlMs: NONCE_TTL_MS, now: clock }),
      now: clock,
      limits: createMarketLimits(clock),
      ip: "203.0.113.7",
    };
  }
}
