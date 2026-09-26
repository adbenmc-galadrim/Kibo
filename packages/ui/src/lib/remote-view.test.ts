import { expect, test } from "bun:test";
import { isRemoteView } from "./remote-view";

test("only a loopback host, or no host at all, is a local view", () => {
  expect(isRemoteView("")).toBe(false);
  expect(isRemoteView("127.0.0.1")).toBe(false);
  expect(isRemoteView("localhost")).toBe(false);
  expect(isRemoteView("[::1]")).toBe(false);
  expect(isRemoteView("192.168.1.20")).toBe(true);
  expect(isRemoteView("kibo.local")).toBe(true);
});
