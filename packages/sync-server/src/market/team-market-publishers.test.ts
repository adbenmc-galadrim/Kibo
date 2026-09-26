import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { encodeKpkg, generateKeyPair, toBase64 } from "@kibo/trust";
import { makeTestPackage } from "@kibo/trust/testing";
import { claimFor, MarketKit, KIT_NOW as NOW, outcome } from "./market-test-kit";

let k: MarketKit;
let lea: string;
let tom: string;

const SMALL_ORDER_KEY = toBase64(
  new Uint8Array([
    0x30,
    0x2a,
    0x30,
    0x05,
    0x06,
    0x03,
    0x2b,
    0x65,
    0x70,
    0x03,
    0x21,
    0x00,
    1,
    ...new Array(31).fill(0),
  ]),
);

beforeEach(async () => {
  k = await MarketKit.create("kibo-team-publishers-");
  lea = (await k.user("Léa")).userId;
  tom = (await k.user("Tom")).userId;
  k.market.grant(lea, "publisher");
  k.market.grant(tom, "publisher");
});
afterEach(() => k.close());

describe("publisher key", () => {
  test("refuses another publisher key for the same component", async () => {
    await k.publishAs(await makeTestPackage(), lea);
    const other = await makeTestPackage({ version: "0.4.0", publisherName: "Tom" });
    expect(await outcome(k.publishAs(other, tom))).toBe("PUBLISHER_CHANGED");
  });
  test("refuses a publisher key registered by another user", async () => {
    const keys = await generateKeyPair();
    await k.publishAs(await makeTestPackage({ keys }), lea);
    expect(await outcome(k.publishAs(await makeTestPackage({ id: "velocity", keys }), tom))).toBe(
      "FORBIDDEN",
    );
  });
  test("refuses a weak publisher key", async () => {
    const made = await makeTestPackage();
    const weak = encodeKpkg({
      ...made.pkg,
      publisher: { ...made.pkg.publisher, publicKey: SMALL_ORDER_KEY },
    });
    expect(await outcome(k.publishAs({ bytes: weak, keys: made.keys }, lea))).toBe("INVALID_INPUT");
  });
});

describe("publisher claim", () => {
  test("a new key without a claim is SIGNATURE_INVALID", async () => {
    const { bytes } = await makeTestPackage();
    expect(await outcome(k.market.publish(bytes, { userId: lea }, NOW))).toBe("SIGNATURE_INVALID");
  });
  test("a claim for another user or another source is refused", async () => {
    const made = await makeTestPackage();
    const forTom = await claimFor(made.keys, tom);
    const elsewhere = await claimFor(made.keys, lea, "autre");
    expect(await outcome(k.market.publish(made.bytes, { userId: lea, publisherClaim: forTom }, NOW))).toBe(
      "SIGNATURE_INVALID",
    );
    expect(await outcome(k.market.publish(made.bytes, { userId: lea, publisherClaim: elsewhere }, NOW))).toBe(
      "SIGNATURE_INVALID",
    );
    expect(await outcome(k.market.publish(made.bytes, { userId: lea, publisherClaim: "%%" }, NOW))).toBe(
      "INVALID_INPUT",
    );
  });
  test("a key copied from another source cannot be claimed without its private key", async () => {
    const owner = await makeTestPackage();
    const thief = await generateKeyPair();
    const claim = await claimFor(thief, tom);
    expect(await outcome(k.market.publish(owner.bytes, { userId: tom, publisherClaim: claim }, NOW))).toBe(
      "SIGNATURE_INVALID",
    );
  });
  test("a registered key needs no claim any more", async () => {
    const first = await makeTestPackage();
    await k.publishAs(first, lea);
    const next = await makeTestPackage({ keys: first.keys, version: "0.4.0" });
    expect(await k.market.publish(next.bytes, { userId: lea }, NOW)).toEqual({ serial: 3 });
  });
});

describe("publisher name", () => {
  test("freezes the name at the first publication", async () => {
    const keys = await generateKeyPair();
    await k.publishAs(await makeTestPackage({ keys, publisherName: "Léa" }), lea);
    const renamed = await makeTestPackage({ keys, version: "0.4.0", publisherName: "Admin" });
    expect(await outcome(k.publishAs(renamed, lea))).toBe("INVALID_INPUT");
    expect((await k.index()).publishers.map((p) => p.name)).toEqual(["Léa"]);
  });
  const spoofs = ["Léa​", "​Léa", "Léa⁠", "‮aéL", "Léa­", "Léa", " léa ", "LÉA"];
  for (const spoof of spoofs) {
    test(`refuses the impostor name ${JSON.stringify(spoof)}`, async () => {
      await k.publishAs(await makeTestPackage({ publisherName: "Léa" }), lea);
      const impostor = await makeTestPackage({ id: "velocity", publisherName: spoof });
      expect(await outcome(k.publishAs(impostor, tom))).toBe("INVALID_INPUT");
      expect((await k.index()).publishers.map((p) => p.name)).toEqual(["Léa"]);
    });
  }
  for (const name of ["Léaㅤ", "Léa️", "Léa\u{e0041}", "Léa  Martin", "Léa "]) {
    test(`refuses the unclean name ${JSON.stringify(name)}`, async () => {
      expect(await outcome(k.publishAs(await makeTestPackage({ publisherName: name }), lea))).toBe(
        "INVALID_INPUT",
      );
    });
  }
  test("accepts a clean name with single spaces", async () => {
    expect(await k.publishAs(await makeTestPackage({ publisherName: "Léa Martin" }), lea)).toEqual({
      serial: 2,
    });
  });
});
