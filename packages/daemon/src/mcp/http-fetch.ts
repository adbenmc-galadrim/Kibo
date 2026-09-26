import { KiboError } from "@kibo/schema";
import type { FetchLike } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  checkedAddress,
  isPublicAddress,
  pinnedRequest,
  type Resolver,
} from "../components/net-proxy-address";
import { directTransport, type Transport } from "../components/net-proxy-transport";

export type PinnedFetchDeps = {
  resolve: Resolver;
  transport?: Transport;
  allowAddress?: (ip: string) => boolean;
};

export function createPinnedFetch(deps: PinnedFetchDeps): FetchLike {
  const transport = deps.transport ?? directTransport;
  const allow = deps.allowAddress ?? isPublicAddress;
  return async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.protocol !== "https:")
      throw new KiboError("PERMISSION_DENIED", "a remote mcp server must use https");
    if (init.body != null && typeof init.body !== "string") {
      throw new KiboError("INVALID_INPUT", "mcp request body must be text");
    }
    const signal = init.signal ?? new AbortController().signal;
    const address = await checkedAddress(url, deps.resolve, allow, signal);
    const pinned = pinnedRequest(url, address);
    return transport(pinned.url, {
      method: init.method ?? "GET",
      headers: { ...Object.fromEntries(new Headers(init.headers)), host: pinned.host },
      body: typeof init.body === "string" ? init.body : undefined,
      redirect: "manual",
      signal,
      tls: pinned.tls,
    });
  };
}
