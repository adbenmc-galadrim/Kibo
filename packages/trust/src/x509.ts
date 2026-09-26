import { KiboError } from "@kibo/schema";
import { fromBase64, owned, sha256Hex, toBase64 } from "./bytes";
import {
  bitString,
  booleanTrue,
  explicit,
  ia5,
  integer,
  ipBytes,
  octetString,
  oid,
  sequence,
  set,
  time,
  tlv,
  utf8String,
} from "./der";

export type SelfSigned = { certPem: string; keyPem: string; fingerprint256: string };

export type SelfSignedOptions = {
  commonName: string;
  dns: string[];
  ips: string[];
  days: number;
  now?: Date;
};

const OID = {
  ecdsaSha256: "1.2.840.10045.4.3.2",
  commonName: "2.5.4.3",
  basicConstraints: "2.5.29.19",
  extKeyUsage: "2.5.29.37",
  serverAuth: "1.3.6.1.5.5.7.3.1",
  subjectAltName: "2.5.29.17",
} as const;

const DAY_MS = 86_400_000;
const DNS_NAME_TAG = 0x82;
const IP_ADDRESS_TAG = 0x87;
const DNS_NAME = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*$/;
const CERT_PEM = /^\s*-----BEGIN CERTIFICATE-----([A-Za-z0-9+/=\s]+)-----END CERTIFICATE-----\s*$/;

function extension(id: string, critical: boolean, value: Uint8Array): Uint8Array {
  return critical
    ? sequence(oid(id), booleanTrue(), octetString(value))
    : sequence(oid(id), octetString(value));
}

function pem(label: string, der: Uint8Array): string {
  const lines = toBase64(der).match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

function p1363ToDer(signature: Uint8Array): Uint8Array {
  return sequence(integer(signature.slice(0, 32)), integer(signature.slice(32)));
}

async function fingerprintOf(der: Uint8Array): Promise<string> {
  return (await sha256Hex(der)).toUpperCase().match(/.{2}/g)?.join(":") ?? "";
}

function randomSerial(): Uint8Array {
  const serial = crypto.getRandomValues(new Uint8Array(16));
  serial[0] = ((serial[0] ?? 0) & 0x3f) | 0x40;
  return serial;
}

function dnsName(name: string): Uint8Array {
  if (!DNS_NAME.test(name)) throw new KiboError("INVALID_INPUT", `invalid DNS name ${name}`);
  return ia5(DNS_NAME_TAG, name);
}

function subjectAltNames(opts: SelfSignedOptions): Uint8Array {
  return sequence(...opts.dns.map(dnsName), ...opts.ips.map((ip) => tlv(IP_ADDRESS_TAG, ipBytes(ip))));
}

function certificateExtensions(altNames: Uint8Array): Uint8Array {
  // No keyUsage: Bun's TLS refuses a self-signed leaf as its own anchor unless keyUsage allows keyCertSign.
  return sequence(
    extension(OID.basicConstraints, true, sequence()),
    extension(OID.extKeyUsage, false, sequence(oid(OID.serverAuth))),
    extension(OID.subjectAltName, false, altNames),
  );
}

export async function generateSelfSignedCert(opts: SelfSignedOptions): Promise<SelfSigned> {
  if (!Number.isInteger(opts.days) || opts.days < 1)
    throw new KiboError("INVALID_INPUT", "days must be a positive integer");
  const altNames = subjectAltNames(opts);
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const start = opts.now ?? new Date();
  const end = new Date(start.getTime() + opts.days * DAY_MS);
  const algorithm = sequence(oid(OID.ecdsaSha256));
  const name = sequence(set(sequence(oid(OID.commonName), utf8String(opts.commonName))));
  const tbs = sequence(
    explicit(0, integer(new Uint8Array([2]))),
    integer(randomSerial()),
    algorithm,
    name,
    sequence(time(start), time(end)),
    name,
    spki,
    explicit(3, certificateExtensions(altNames)),
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, owned(tbs)),
  );
  const der = sequence(tbs, algorithm, bitString(p1363ToDer(signature)));
  return {
    certPem: pem("CERTIFICATE", der),
    keyPem: pem("PRIVATE KEY", pkcs8),
    fingerprint256: await fingerprintOf(der),
  };
}

export async function certFingerprint(certPem: string): Promise<string> {
  const body = CERT_PEM.exec(certPem)?.[1];
  if (body === undefined) throw new KiboError("INVALID_INPUT", "invalid certificate PEM");
  return fingerprintOf(fromBase64(body.replace(/\s+/g, "")));
}
