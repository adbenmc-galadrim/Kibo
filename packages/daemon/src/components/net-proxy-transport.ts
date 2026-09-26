import type { IncomingMessage } from "node:http";
import { request } from "node:https";

export type TransportInit = {
  method: string;
  headers: Record<string, string>;
  body?: string;
  redirect: "manual";
  signal: AbortSignal;
  tls?: { serverName: string };
};
export type Transport = (url: string, init: TransportInit) => Promise<Response>;
export type DirectTransportOptions = { ca?: string };

const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

function responseHeaders(res: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(res.headers)) {
    for (const item of [value ?? []].flat()) headers.append(name, item);
  }
  return headers;
}

function webStream(res: IncomingMessage): ReadableStream<Uint8Array> {
  let settled = false;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      res.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
        if ((controller.desiredSize ?? 0) <= 0) res.pause();
      });
      res.on("end", () => {
        settled = true;
        controller.close();
      });
      res.on("error", (error) => {
        if (settled) return;
        settled = true;
        controller.error(error);
      });
      res.on("close", () => {
        if (settled) return;
        settled = true;
        controller.error(new Error("response closed before its end"));
      });
    },
    pull() {
      res.resume();
    },
    cancel() {
      settled = true;
      res.destroy();
    },
  });
}

export function createDirectTransport(options: DirectTransportOptions = {}): Transport {
  return (url, init) =>
    new Promise((resolve, reject) => {
      const req = request(
        url,
        {
          method: init.method,
          headers: init.headers,
          servername: init.tls?.serverName,
          signal: init.signal,
          agent: false,
          ca: options.ca,
        },
        (res) => {
          const status = res.statusCode ?? 0;
          const body = NULL_BODY_STATUSES.has(status) ? null : webStream(res);
          if (body === null) res.resume();
          try {
            resolve(new Response(body, { status, headers: responseHeaders(res) }));
          } catch (error) {
            res.destroy();
            reject(error);
          }
        },
      );
      req.on("error", reject);
      req.end(init.body);
    });
}

export const directTransport: Transport = createDirectTransport();
