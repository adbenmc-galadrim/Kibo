import { expect, test } from "bun:test";
import { hostOf } from "./host-of";

test("hostOf keeps the host and port, and leaves an unparsable address as is", () => {
  expect(hostOf("wss://sync.galadrim.fr")).toBe("sync.galadrim.fr");
  expect(hostOf("wss://10.0.0.2:8443/sync")).toBe("10.0.0.2:8443");
  expect(hostOf("pas une adresse")).toBe("pas une adresse");
});
