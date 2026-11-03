import { MacMessage, PhoneEvent, type SealedRequest, ServerMessage } from "@kibo/remote/protocol";
import { z } from "zod";
import { openDb } from "../db";
import { createSession } from "../phone-sessions";
import { type RemoteServerOptions, serveRemote } from "../server";
import type { WebauthnPort } from "../webauthn-port";
import { openSocket, type SocketQueue } from "./ws-queue";

const SETUP_CODE = "test-setup";
const Registered = z.object({ accountId: z.string().uuid() });

export type TestServer = {
  url: string;
  setupCode: string;
  now(): number;
  advance(ms: number): void;
  registerMac(macToken?: string): Promise<{ macToken: string; accountId: string }>;
  phoneCookie(): string;
  stop(): Promise<void>;
};

export type FakeMac = SocketQueue<ServerMessage> & { put(message: MacMessage): void };
export type RequestHandler = (
  request: Extract<ServerMessage, { type: "request" }>,
) => SealedRequest | null | Promise<SealedRequest | null>;

const unreachable = (): never => {
  throw new Error("webauthn is not available in this test server");
};

const fakeWebauthn = (): WebauthnPort => ({
  registrationOptions: async () => unreachable(),
  verifyRegistration: async () => unreachable(),
  authenticationOptions: async () => unreachable(),
  verifyAuthentication: async () => unreachable(),
});

const wsUrl = (url: string, path: string) => `${url.replace(/^http/, "ws")}${path}`;

export async function startTestServer(
  overrides: Partial<Omit<RemoteServerOptions, "db" | "port">> = {},
): Promise<TestServer> {
  let clock = 1_700_000_000_000;
  const now = overrides.now ?? (() => clock);
  const db = openDb(":memory:");
  const server = serveRemote(db, {
    port: 0,
    origin: "http://127.0.0.1",
    rpId: "127.0.0.1",
    setupCode: SETUP_CODE,
    staticDir: null,
    webauthn: fakeWebauthn(),
    ...overrides,
    now,
  });
  const registerMac = async (macToken = crypto.randomUUID()) => {
    const res = await fetch(`${server.url}/api/mac/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ setupCode: SETUP_CODE, macToken }),
    });
    if (res.status !== 200) throw new Error(`register failed with ${res.status}`);
    const { accountId } = Registered.parse(await res.json());
    return { macToken, accountId };
  };
  return {
    url: server.url,
    setupCode: SETUP_CODE,
    now,
    advance: (ms) => {
      clock += ms;
    },
    registerMac,
    phoneCookie: () => `kibo_phone=${createSession(db, now())}`,
    stop: async () => {
      await server.stop();
      db.close();
    },
  };
}

export async function connectFakeMac(
  url: string,
  macToken: string,
  onRequest?: RequestHandler,
): Promise<FakeMac> {
  let reply: (message: unknown) => void = () => {};
  const answer = async (request: Extract<ServerMessage, { type: "request" }>) => {
    const sealed = await onRequest?.(request);
    if (sealed) reply({ type: "request.reply", requestId: request.requestId, sealed });
  };
  const queue = await openSocket(
    wsUrl(url, "/api/mac"),
    { authorization: `Bearer ${macToken}` },
    (data) => ServerMessage.parse(data),
    (message) => {
      if (message.type !== "request" || !onRequest) return false;
      void answer(message);
      return true;
    },
  );
  reply = queue.send;
  return { ...queue, put: (message) => queue.send(MacMessage.parse(message)) };
}

export function connectPhoneEvents(url: string, cookie: string): Promise<SocketQueue<PhoneEvent>> {
  return openSocket(wsUrl(url, "/api/phone/events"), { cookie }, (data) => PhoneEvent.parse(data));
}
