import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

const native = {
  fetch: globalThis.fetch,
  Request: globalThis.Request,
  Response: globalThis.Response,
  Headers: globalThis.Headers,
  WebSocket: globalThis.WebSocket,
  Blob: globalThis.Blob,
};

GlobalRegistrator.register();
Object.assign(globalThis, native);

const { cleanup } = await import("@testing-library/react");
afterEach(cleanup);
