import { GlobalRegistrator } from "@happy-dom/global-registrator";

const native = {
  fetch: globalThis.fetch,
  Request: globalThis.Request,
  Response: globalThis.Response,
  Headers: globalThis.Headers,
  WebSocket: globalThis.WebSocket,
};

GlobalRegistrator.register();
Object.assign(globalThis, native);
