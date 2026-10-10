import { expect, test } from "bun:test";
import fc from "fast-check";
import { hasSecret, MASKED, maskSecrets, maskSecretsWithin } from "./secret-mask";

const SAMPLES: readonly RegExp[] = [
  /^sk-[A-Za-z0-9_-]{16,40}$/,
  /^ghp_[A-Za-z0-9]{20,40}$/,
  /^github_pat_[A-Za-z0-9_]{20,40}$/,
  /^xox[abprs]-[A-Za-z0-9-]{10,30}$/,
  /^AKIA[0-9A-Z]{16}$/,
  /^Authorization: Bearer [A-Za-z0-9._-]{8,30}$/,
  /^[A-Z]{1,8}_(TOKEN|KEY|SECRET|PASSWORD)=[A-Za-z0-9]{1,30}$/,
  /^PASSWORD=[A-Za-z0-9]{1,30}$/,
  /^-----BEGIN RSA PRIVATE KEY-----\n[A-Za-z0-9+/\n]{1,60}\n-----END RSA PRIVATE KEY-----$/,
  /^-----BEGIN EC PRIVATE KEY-----\n[A-Za-z0-9+/\n]{0,60}$/,
];

test("each kind of secret is masked", () => {
  const cases: [string, string][] = [
    ["key sk-abcdefghijklmnop1234", `key ${MASKED}`],
    ["ghp_abcdefghijklmnopqrstu1", MASKED],
    ["github_pat_11ABCDEFGHIJKLMNOPQRST", MASKED],
    ["xoxb-1234567890-abc", MASKED],
    ["AKIAABCDEFGHIJKLMNOP", MASKED],
    ["Authorization: Bearer abc.def", `Authorization: ${MASKED}`],
    ["GITHUB_TOKEN=abc123 suite", `GITHUB_TOKEN=${MASKED} suite`],
    ["API_KEY = xyz", `API_KEY = ${MASKED}`],
    ["CLIENT_SECRET=s3cr3t", `CLIENT_SECRET=${MASKED}`],
    ["PASSWORD=hunter2", `PASSWORD=${MASKED}`],
    ["a\n-----BEGIN OPENSSH PRIVATE KEY-----\nAAAB\n-----END OPENSSH PRIVATE KEY-----\nb", `a\n${MASKED}\nb`],
  ];
  for (const [text, masked] of cases) {
    expect(hasSecret(text)).toBe(true);
    expect(maskSecrets(text)).toBe(masked);
    expect(hasSecret(maskSecrets(text))).toBe(false);
  }
});

test("a private key block cut before its END line is masked to the end of the text", () => {
  const text = "cat id_rsa\n-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA\nAAAB";
  expect(hasSecret(text)).toBe(true);
  expect(maskSecrets(text)).toBe(`cat id_rsa\n${MASKED}`);
  expect(hasSecret(maskSecrets(text))).toBe(false);
});

test("ordinary text is left alone", () => {
  for (const text of ["risk-assessment-documentation", "Je corrige la validation.", "bun test packages"]) {
    expect(hasSecret(text)).toBe(false);
    expect(maskSecrets(text)).toBe(text);
  }
});

test("no secret survives the mask, and masking twice changes nothing", () => {
  const secret = fc.constantFrom(...SAMPLES).chain((pattern) => fc.stringMatching(pattern));
  fc.assert(
    fc.property(fc.string(), secret, fc.string(), (before, value, after) => {
      const text = `${before} ${value} ${after}`;
      const masked = maskSecrets(text);
      expect(hasSecret(text)).toBe(true);
      expect(hasSecret(masked)).toBe(false);
      expect(maskSecrets(masked)).toBe(masked);
    }),
  );
});

test("text without a secret is unchanged", () => {
  fc.assert(
    fc.property(fc.string(), (text) => {
      if (!hasSecret(text)) expect(maskSecrets(text)).toBe(text);
    }),
  );
});

test("masking within a length never exceeds it and never leaves a cut secret behind", () => {
  const secret = fc.constantFrom(...SAMPLES).chain((pattern) => fc.stringMatching(pattern));
  fc.assert(
    fc.property(fc.string(), secret, fc.string(), fc.nat(120), (before, value, after, max) => {
      const masked = maskSecretsWithin(`${before} ${value} ${after}`, max);
      expect(masked.length).toBeLessThanOrEqual(max);
      expect(hasSecret(masked)).toBe(false);
    }),
  );
});

test("masking within a length keeps a short clean text and re-masks a cut mask", () => {
  expect(maskSecretsWithin("Je corrige la validation.", 100)).toBe("Je corrige la validation.");
  expect(maskSecretsWithin("PASSWORD=hunter2 fin", 20)).toBe(`PASSWORD=${MASKED}`);
});
