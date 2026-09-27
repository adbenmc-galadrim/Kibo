import { expect, test } from "bun:test";
import type { NetworkInterfaceInfo } from "node:os";
import { listInterfaces } from "./interfaces";

const v4 = (address: string): NetworkInterfaceInfo => ({
  address,
  family: "IPv4",
  netmask: "",
  mac: "",
  internal: false,
  cidr: null,
});
const v6 = (address: string): NetworkInterfaceInfo => ({
  address,
  family: "IPv6",
  netmask: "",
  mac: "",
  internal: false,
  cidr: null,
  scopeid: 0,
});

test("lists concrete addresses, never the wildcard nor link-local IPv6", () => {
  expect(
    listInterfaces({
      lo0: [v4("127.0.0.1"), v6("::1")],
      en0: [v4("192.168.1.20"), v6("fe80::1c2b:3aff:fe4d:5e6f"), v6("2a01:e0a::20")],
      bogus: [v4("0.0.0.0"), v6("::")],
    }),
  ).toEqual([
    { name: "lo0", address: "127.0.0.1" },
    { name: "lo0", address: "::1" },
    { name: "en0", address: "192.168.1.20" },
    { name: "en0", address: "2a01:e0a::20" },
  ]);
});

test("reads the machine interfaces by default", () => {
  expect(listInterfaces().some((i) => i.address === "127.0.0.1")).toBe(true);
});
