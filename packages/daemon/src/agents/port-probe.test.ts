import { expect, test } from "bun:test";
import { isFree } from "./port-probe";

const hold = (hostname: string) => Bun.listen({ hostname, port: 0, socket: { data() {} } });

test("a port held on the loopback is busy, then free once released", async () => {
  const held = hold("127.0.0.1");
  expect(await isFree(held.port)).toBe(false);
  held.stop(true);
  expect(await isFree(held.port)).toBe(true);
});

test("a port held on every interface or on the IPv6 loopback is busy too", async () => {
  for (const hostname of ["0.0.0.0", "::", "::1"]) {
    const held = hold(hostname);
    expect(await isFree(held.port)).toBe(false);
    held.stop(true);
  }
});
