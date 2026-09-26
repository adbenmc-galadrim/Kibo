import { expect, test } from "bun:test";
import { X509Certificate } from "node:crypto";
import { certFingerprint, generateSelfSignedCert } from "./x509";

const now = new Date("2026-09-26T10:00:00Z");

test("the certificate is parsed by the platform with SAN and validity", async () => {
  const cert = await generateSelfSignedCert({
    commonName: "Kibo",
    dns: ["localhost"],
    ips: ["127.0.0.1"],
    days: 30,
    now,
  });
  const x = new X509Certificate(cert.certPem);
  expect(x.subject).toContain("CN=Kibo");
  expect(x.issuer).toBe(x.subject);
  expect(x.subjectAltName).toContain("DNS:localhost");
  expect(x.subjectAltName).toContain("IP Address:127.0.0.1");
  expect(new Date(x.validFrom).getTime()).toBeLessThanOrEqual(now.getTime());
  expect(new Date(x.validTo).getTime()).toBe(now.getTime() + 30 * 86_400_000);
  expect(x.ca).toBe(false);
  expect(x.checkIssued(x)).toBe(true);
});

test("the private key is PKCS8 PEM and the fingerprint matches the DER", async () => {
  const cert = await generateSelfSignedCert({
    commonName: "Kibo",
    dns: [],
    ips: ["127.0.0.1"],
    days: 1,
    now,
  });
  expect(cert.keyPem.startsWith("-----BEGIN PRIVATE KEY-----\n")).toBe(true);
  expect(cert.certPem.startsWith("-----BEGIN CERTIFICATE-----\n")).toBe(true);
  expect(cert.fingerprint256).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  expect(await certFingerprint(cert.certPem)).toBe(cert.fingerprint256);
  expect(new X509Certificate(cert.certPem).fingerprint256).toBe(cert.fingerprint256);
});

test("the signature verifies with the certificate public key", async () => {
  const cert = await generateSelfSignedCert({ commonName: "Kibo", dns: [], ips: ["::1"], days: 1, now });
  const x = new X509Certificate(cert.certPem);
  expect(x.verify(x.publicKey)).toBe(true);
  expect(x.subjectAltName).toContain("IP Address:0:0:0:0:0:0:0:1");
});

test("two certificates never share a serial or a key", async () => {
  const a = await generateSelfSignedCert({ commonName: "Kibo", dns: [], ips: ["127.0.0.1"], days: 1, now });
  const b = await generateSelfSignedCert({ commonName: "Kibo", dns: [], ips: ["127.0.0.1"], days: 1, now });
  expect(new X509Certificate(a.certPem).serialNumber).not.toBe(new X509Certificate(b.certPem).serialNumber);
  expect(a.keyPem).not.toBe(b.keyPem);
});

test("an invalid IP is refused", async () => {
  await expect(
    generateSelfSignedCert({ commonName: "Kibo", dns: [], ips: ["nope"], days: 1 }),
  ).rejects.toThrow("INVALID_INPUT");
});

test("an invalid DNS name or duration is refused", async () => {
  await expect(
    generateSelfSignedCert({ commonName: "Kibo", dns: ["bad host"], ips: [], days: 1 }),
  ).rejects.toThrow("INVALID_INPUT");
  await expect(
    generateSelfSignedCert({ commonName: "Kibo", dns: ["héhé.local"], ips: [], days: 1 }),
  ).rejects.toThrow("INVALID_INPUT");
  await expect(
    generateSelfSignedCert({ commonName: "Kibo", dns: ["localhost"], ips: [], days: 0 }),
  ).rejects.toThrow("INVALID_INPUT");
});

test("a malformed PEM has no fingerprint", async () => {
  await expect(certFingerprint("not a certificate")).rejects.toThrow("INVALID_INPUT");
  await expect(
    certFingerprint("-----BEGIN CERTIFICATE-----\n@@@\n-----END CERTIFICATE-----\n"),
  ).rejects.toThrow("INVALID_INPUT");
});

const base = { commonName: "Kibo", dns: ["localhost"], ips: [], days: 1, now };

test("the duration is an integer from 1 to 825 days", async () => {
  for (const days of [0, 826, 1.5, Number.NaN]) {
    await expect(generateSelfSignedCert({ ...base, days })).rejects.toThrow("INVALID_INPUT");
  }
  const cert = await generateSelfSignedCert({ ...base, days: 825 });
  expect(new Date(new X509Certificate(cert.certPem).validTo).getTime()).toBe(
    now.getTime() + 825 * 86_400_000,
  );
});

test("at least one name and a common name of 1 to 64 characters", async () => {
  await expect(generateSelfSignedCert({ ...base, dns: [], ips: [] })).rejects.toThrow("INVALID_INPUT");
  await expect(generateSelfSignedCert({ ...base, commonName: "" })).rejects.toThrow("INVALID_INPUT");
  await expect(generateSelfSignedCert({ ...base, commonName: "k".repeat(65) })).rejects.toThrow(
    "INVALID_INPUT",
  );
  const cert = await generateSelfSignedCert({ ...base, commonName: "k".repeat(64) });
  expect(new X509Certificate(cert.certPem).subject).toContain(`CN=${"k".repeat(64)}`);
});

test("DNS names follow the label rules", async () => {
  const refused = [
    "-kibo.local",
    "kibo-.local",
    "kibo..local",
    ".kibo",
    `${"a".repeat(64)}.local`,
    `${"a.".repeat(126)}ab`,
    "127.0.0.1",
    "10",
  ];
  for (const name of refused) {
    await expect(generateSelfSignedCert({ ...base, dns: [name] })).rejects.toThrow("INVALID_INPUT");
  }
  const accepted = ["kibo-1.local", `${"a".repeat(63)}.local`, "9kibo.local", "a"];
  const cert = await generateSelfSignedCert({ ...base, dns: accepted });
  for (const name of accepted)
    expect(new X509Certificate(cert.certPem).subjectAltName).toContain(`DNS:${name}`);
});

test("a PEM that does not hold a certificate has no fingerprint", async () => {
  const wrap = (bytes: Uint8Array) =>
    `-----BEGIN CERTIFICATE-----\n${Buffer.from(bytes).toString("base64")}\n-----END CERTIFICATE-----\n`;
  await expect(certFingerprint(wrap(new Uint8Array([1, 2, 3])))).rejects.toThrow("INVALID_INPUT");
  await expect(certFingerprint(wrap(new Uint8Array([0x30, 0x03, 1, 2, 3, 4])))).rejects.toThrow(
    "INVALID_INPUT",
  );
  await expect(certFingerprint(wrap(new Uint8Array([0x30, 0x01, 0x05])))).rejects.toThrow("INVALID_INPUT");
});

test("a full chain PEM is refused", async () => {
  const a = await generateSelfSignedCert(base);
  const b = await generateSelfSignedCert(base);
  await expect(certFingerprint(a.certPem + b.certPem)).rejects.toThrow("INVALID_INPUT");
});
