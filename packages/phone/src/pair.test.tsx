import { afterEach, beforeEach, expect, test } from "bun:test";
import { deriveKeys, encodePairingCode, generateRootKey, INDEX_PROJECT_ID } from "@kibo/remote";
import {
  connectFakeMac,
  type FakeMac,
  startTestServer,
  TEST_ORIGIN,
  type TestServer,
} from "@kibo/remote-server/testing";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createKeyStore } from "./key-store";
import type { PasskeyPort } from "./pairing";
import { Pair } from "./screens/Pair";
import { createServerApi } from "./server-api";
import { createSnapshotStore } from "./snapshot-store";
import { memoryStorage } from "./storage";
import { sealJson } from "./test-kit";

const toBase64Url = (text: string) => Buffer.from(text).toString("base64url");

const registration = (challenge: string): RegistrationResponseJSON => ({
  id: "fake-cred",
  rawId: "fake-cred",
  type: "public-key",
  clientExtensionResults: {},
  response: {
    clientDataJSON: toBase64Url(JSON.stringify({ type: "webauthn.create", challenge, origin: TEST_ORIGIN })),
    attestationObject: toBase64Url("attestation"),
  },
});

function phoneFetch(): typeof fetch {
  let cookie = "";
  const wrapped = async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.set("origin", TEST_ORIGIN);
    if (cookie) headers.set("cookie", cookie);
    const res = await fetch(input, { ...init, headers });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0] ?? "";
    return res;
  };
  return Object.assign(wrapped, { preconnect: fetch.preconnect });
}

let server: TestServer;
let mac: FakeMac;
let accountId: string;
let pairToken: string;

beforeEach(async () => {
  server = await startTestServer();
  const registered = await server.registerMac();
  accountId = registered.accountId;
  mac = await connectFakeMac(server.url, registered.macToken);
  mac.put({ type: "pair.create" });
  pairToken = (await mac.next("pair.created")).pairToken;
});

afterEach(async () => {
  await mac.close();
  await server.stop();
});

const paste = async (code: string) => {
  await userEvent.type(screen.getByLabelText("Coller le code"), code);
  await userEvent.click(screen.getByRole("button", { name: "Appairer" }));
};

test("Pair screen accepts a pasted kibo1. code, calls pair/options and pair/verify through @simplewebauthn/browser (mocked) and stores the key", async () => {
  const rootKey = generateRootKey();
  const keys = await deriveKeys(rootKey, accountId, 1);
  mac.put({
    type: "snapshot.put",
    sealed: await sealJson(keys, INDEX_PROJECT_ID, "projects", { viewer: "adam", projects: [] }),
  });
  const storage = memoryStorage();
  const keyStore = createKeyStore(storage.keys);
  const snapshots = createSnapshotStore(storage.snapshots);
  const asked: PublicKeyCredentialCreationOptionsJSON[] = [];
  const passkeys: PasskeyPort = {
    create: async (options) => {
      asked.push(options);
      return registration(options.challenge);
    },
    get: async () => {
      throw new Error("not used");
    },
  };
  let paired = 0;
  const api = createServerApi({ baseUrl: server.url, fetch: phoneFetch() });
  render(<Pair deps={{ api, passkeys, keyStore, snapshots }} onPaired={() => paired++} />);
  await paste(encodePairingCode({ accountId, pairToken, rootKey }));
  await waitFor(() => expect(paired).toBe(1));
  expect(asked).toHaveLength(1);
  expect(asked[0]?.authenticatorSelection?.userVerification).toBe("required");
  const stored = await keyStore.load();
  expect(stored?.accountId).toBe(accountId);
  expect(stored?.keys.epoch).toBe(1);
  expect(snapshots.get(INDEX_PROJECT_ID, "projects")).not.toBeNull();
  expect(await api.session()).toBe(true);
});

test('an invalid code shows "Code invalide ou expiré"', async () => {
  const storage = memoryStorage();
  const deps = {
    api: createServerApi({ baseUrl: server.url, fetch: phoneFetch() }),
    passkeys: { create: async () => registration("x"), get: async () => Promise.reject(new Error("unused")) },
    keyStore: createKeyStore(storage.keys),
    snapshots: createSnapshotStore(storage.snapshots),
  };
  render(<Pair deps={deps} onPaired={() => undefined} />);
  await paste("kibo1.abc");
  expect((await screen.findByRole("alert")).textContent).toBe("Code invalide ou expiré");
  await userEvent.clear(screen.getByLabelText("Coller le code"));
  const wrongToken = encodePairingCode({
    accountId,
    pairToken: toBase64Url("0123456789abcdef"),
    rootKey: generateRootKey(),
  });
  await paste(wrongToken);
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Code invalide ou expiré"));
  expect(await deps.keyStore.load()).toBeNull();
});
