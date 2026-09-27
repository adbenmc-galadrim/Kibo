import { type ClientFrame, challengePayload, JoinResponse, ServerFrame } from "@kibo/schema";
import { generateKeyPair, type KeyPair, signBytes } from "@kibo/trust";
import { z } from "zod";
import { createInvite } from "../accounts";
import type { TestSyncServer } from "./start-test-server";

export type TestDevice = { userId: string; deviceId: string; name: string; keys: KeyPair };

const JoinReply = z.object({
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z.object({ code: z.string() }).optional(),
});

async function join(t: TestSyncServer, code: string, deviceName: string): Promise<TestDevice> {
  const keys = await generateKeyPair();
  const res = await fetch(`${t.httpsUrl}/v1/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, publicKey: keys.publicKey, deviceName }),
    tls: { ca: t.caPem },
  });
  const body = JoinReply.parse(await res.json());
  if (!body.ok) throw new Error(`join failed: ${body.error?.code ?? res.status}`);
  return { ...JoinResponse.parse(body.result), keys };
}

export async function joinTestAccount(t: TestSyncServer, name: string): Promise<TestDevice> {
  return join(t, await t.inviteAccount(name), `Mac de ${name}`);
}

export async function addTestDevice(
  t: TestSyncServer,
  user: TestDevice,
  deviceName: string,
): Promise<TestDevice> {
  const invite = await createInvite(
    t.server.sdb,
    { kind: "device", userId: user.userId, createdBy: user.userId },
    t.now(),
  );
  return join(t, invite.code, deviceName);
}

function openTlsSocket(url: string, ca: string): WebSocket {
  const options: Bun.WebSocketOptions = { tls: { ca } };
  return Reflect.construct(WebSocket, [url, options]);
}

type Waiter = { match: (f: ServerFrame) => boolean; resolve: (f: ServerFrame) => void };

export class TestClient {
  private readonly frames: ServerFrame[] = [];
  private readonly consumed = new Set<ServerFrame>();
  private readonly waiters: Waiter[] = [];
  readonly closed: Promise<number>;

  private constructor(
    private readonly ws: WebSocket,
    private readonly t: TestSyncServer,
  ) {
    this.closed = new Promise((resolve) => ws.addEventListener("close", (e) => resolve(e.code)));
    ws.addEventListener("message", (e) => this.receive(ServerFrame.parse(JSON.parse(String(e.data)))));
  }

  static async open(t: TestSyncServer): Promise<TestClient> {
    const ws = openTlsSocket(`${t.url}/v1/sync`, t.caPem);
    const client = new TestClient(ws, t);
    await client.next("challenge");
    return client;
  }

  async auth(device: TestDevice, override: { privateKey?: string; origin?: string } = {}): Promise<void> {
    const challenge = this.frames.find((f) => f.type === "challenge");
    if (!challenge || challenge.type !== "challenge") throw new Error("no challenge received");
    const payload = challengePayload(challenge.nonce, override.origin ?? this.t.origin);
    const signature = await signBytes(override.privateKey ?? device.keys.privateKey, payload);
    this.send({ type: "auth", deviceId: device.deviceId, signature });
  }

  send(frame: ClientFrame): void {
    this.ws.send(JSON.stringify(frame));
  }

  sendRaw(text: string): void {
    this.ws.send(text);
  }

  received(type: ServerFrame["type"]): ServerFrame[] {
    return this.frames.filter((f) => f.type === type);
  }

  next<T extends ServerFrame["type"]>(
    type: T,
    match: (f: Extract<ServerFrame, { type: T }>) => boolean = () => true,
    timeoutMs = 3000,
  ): Promise<Extract<ServerFrame, { type: T }>> {
    const accepts = (f: ServerFrame): f is Extract<ServerFrame, { type: T }> =>
      f.type === type && match(f as Extract<ServerFrame, { type: T }>);
    const ready = this.frames.find((f) => !this.consumed.has(f) && accepts(f));
    if (ready && accepts(ready)) {
      this.consumed.add(ready);
      return Promise.resolve(ready);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), timeoutMs);
      this.waiters.push({
        match: accepts,
        resolve: (f) => {
          clearTimeout(timer);
          if (accepts(f)) resolve(f);
        },
      });
    });
  }

  close(): void {
    this.ws.close();
  }

  private receive(frame: ServerFrame): void {
    this.frames.push(frame);
    const waiter = this.waiters.find((w) => w.match(frame));
    if (!waiter) return;
    this.waiters.splice(this.waiters.indexOf(waiter), 1);
    this.consumed.add(frame);
    waiter.resolve(frame);
  }
}
