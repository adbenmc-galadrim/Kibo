import { type NetworkInterfaceInfo, networkInterfaces } from "node:os";

export type NetworkAddress = { name: string; address: string };

const WILDCARDS = new Set(["0.0.0.0", "::"]);

const usable = (address: string) => !WILDCARDS.has(address) && !address.toLowerCase().startsWith("fe80:");

export function listInterfaces(
  source: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces(),
): NetworkAddress[] {
  return Object.entries(source).flatMap(([name, infos]) =>
    (infos ?? []).filter((i) => usable(i.address)).map((i) => ({ name, address: i.address })),
  );
}
