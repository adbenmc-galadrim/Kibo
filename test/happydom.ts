import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

const native = {
  fetch: globalThis.fetch,
  Request: globalThis.Request,
  Response: globalThis.Response,
  Headers: globalThis.Headers,
  WebSocket: globalThis.WebSocket,
  Blob: globalThis.Blob,
  AbortController: globalThis.AbortController,
  AbortSignal: globalThis.AbortSignal,
  TransformStream: globalThis.TransformStream,
  WritableStream: globalThis.WritableStream,
};

GlobalRegistrator.register();
Object.assign(globalThis, native);

const { cleanup, configure } = await import("@testing-library/react");
configure({ asyncUtilTimeout: 4_000 });
afterEach(cleanup);
