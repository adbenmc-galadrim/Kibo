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

GlobalRegistrator.register({
  settings: {
    disableJavaScriptFileLoading: true,
    disableCSSFileLoading: true,
    handleDisabledFileLoadingAsSuccess: true,
    navigation: {
      disableMainFrameNavigation: true,
      disableChildFrameNavigation: true,
      disableChildPageNavigation: true,
    },
  },
});
Object.assign(globalThis, native);

function fakeAnimate(): Animation {
  const animation = new EventTarget();
  setTimeout(() => animation.dispatchEvent(new Event("finish")), 0);
  return Object.assign(animation, { cancel() {}, finished: Promise.resolve() }) as unknown as Animation;
}

// happy-dom has no Web Animations API, which auto-animate calls on every list change.
Element.prototype.animate = fakeAnimate;

const { cleanup, configure } = await import("@testing-library/react");
configure({ asyncUtilTimeout: 4_000 });
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});
