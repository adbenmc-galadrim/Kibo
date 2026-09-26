import { afterAll, beforeAll, expect, test } from "bun:test";
import type { Server } from "bun";
import { generateSelfSignedCert, type SelfSigned } from "./x509";

let cert: SelfSigned;
let server: Server<undefined>;

beforeAll(async () => {
  cert = await generateSelfSignedCert({
    commonName: "Kibo test",
    dns: ["localhost"],
    ips: ["127.0.0.1"],
    days: 1,
  });
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    tls: { cert: cert.certPem, key: cert.keyPem },
    fetch(req, srv) {
      if (new URL(req.url).pathname === "/ws" && srv.upgrade(req, { data: undefined })) return undefined;
      return new Response("ok");
    },
    websocket: {
      message(ws, msg) {
        ws.send(`echo:${String(msg)}`);
      },
    },
  });
});
afterAll(() => server.stop(true));

function openSocket(ca: string): WebSocket {
  const options: Bun.WebSocketOptions = { tls: { ca } };
  // lib.dom (loaded by this package) hides the Bun overload of the WebSocket constructor that takes options.
  const socket: WebSocket = Reflect.construct(WebSocket, [`wss://127.0.0.1:${server.port}/ws`, options]);
  return socket;
}

test("fetch trusts the generated certificate through tls.ca", async () => {
  const res = await fetch(`https://127.0.0.1:${server.port}/`, { tls: { ca: cert.certPem } });
  expect(await res.text()).toBe("ok");
});

test("fetch without the CA refuses the certificate", async () => {
  await expect(fetch(`https://127.0.0.1:${server.port}/`)).rejects.toThrow();
});

test("the Bun WebSocket client accepts tls.ca", async () => {
  const ws = openSocket(cert.certPem);
  const reply = await new Promise<string>((resolve, reject) => {
    ws.addEventListener("open", () => ws.send("ping"));
    ws.addEventListener("message", (e) => resolve(String(e.data)));
    ws.addEventListener("error", () => reject(new Error("websocket error")));
  });
  ws.close();
  expect(reply).toBe("echo:ping");
});

test("the Bun WebSocket client refuses an unknown CA", async () => {
  const ws = new WebSocket(`wss://127.0.0.1:${server.port}/ws`);
  const outcome = await new Promise<string>((resolve) => {
    ws.addEventListener("open", () => resolve("open"));
    ws.addEventListener("error", () => resolve("error"));
    ws.addEventListener("close", () => resolve("close"));
  });
  expect(outcome).not.toBe("open");
});

test("the Bun WebSocket client refuses a certificate other than its tls.ca", async () => {
  const other = await generateSelfSignedCert({
    commonName: "Kibo test",
    dns: ["localhost"],
    ips: ["127.0.0.1"],
    days: 1,
  });
  const ws = openSocket(other.certPem);
  const outcome = await new Promise<string>((resolve) => {
    ws.addEventListener("open", () => resolve("open"));
    ws.addEventListener("error", () => resolve("error"));
    ws.addEventListener("close", () => resolve("close"));
  });
  expect(outcome).not.toBe("open");
});
