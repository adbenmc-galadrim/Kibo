import { expect, test } from "bun:test";
import { devProxy } from "./dev-proxy";

test("the Vite dev server forwards the api and the trusted component modules to the daemon", () => {
  const daemon = "http://127.0.0.1:4317";
  expect(devProxy(daemon)).toEqual({
    "/api": { target: daemon, changeOrigin: true, ws: true },
    "/components": { target: daemon, changeOrigin: true },
  });
});
