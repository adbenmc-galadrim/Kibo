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
