import { expect } from "bun:test";
import { z } from "zod";
import { fakeAssertion, fakeRegistration } from "./fake-webauthn";
import { connectFakeMac, type FakeMac, TEST_ORIGIN, type TestServer } from "./test-server";

const Options = z.object({ challenge: z.string().min(1) });

type Call = { cookie?: string; origin?: string | null };
type Pairing = { accountId: string; pairToken: string };

export const cookieOf = (res: Response) => (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

export const expectError = async (res: Response, status: number, code: string) => {
  expect(res.status).toBe(status);
  expect(await res.json()).toMatchObject({ ok: false, error: { code } });
};

export const challengeFrom = async (res: Response) => Options.parse(await res.json()).challenge;

export function phoneAuth(server: TestServer) {
  const macs: FakeMac[] = [];
  const post = (path: string, body: unknown, { cookie, origin = TEST_ORIGIN }: Call = {}) =>
    fetch(`${server.url}/api/phone/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(origin === null ? {} : { origin }),
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });
  const pairing = async (): Promise<Pairing & { mac: FakeMac }> => {
    const registered = await server.registerMac();
    const mac = await connectFakeMac(server.url, registered.macToken);
    macs.push(mac);
    mac.put({ type: "pair.create" });
    const { pairToken } = await mac.next("pair.created");
    return { accountId: registered.accountId, pairToken, mac };
  };
  const pairVerify = async ({ accountId, pairToken }: Pairing, origin = TEST_ORIGIN) => {
    const challenge = await challengeFrom(await post("pair/options", { accountId, pairToken }));
    return post("pair/verify", { accountId, pairToken, response: fakeRegistration(challenge, origin) });
  };
  return {
    post,
    pairing,
    pairVerify,
    session: (cookie: string) => fetch(`${server.url}/api/phone/session`, { headers: { cookie } }),
    pairPhone: async () => {
      const pair = await pairing();
      const res = await pairVerify(pair);
      expect(res.status).toBe(200);
      return { ...pair, cookie: cookieOf(res) };
    },
    login: async (counter: number) => {
      const challenge = await challengeFrom(await post("login/options", {}));
      return post("login/verify", { response: fakeAssertion(challenge, TEST_ORIGIN, counter) });
    },
    close: () => Promise.all(macs.map((mac) => mac.close())),
  };
}
