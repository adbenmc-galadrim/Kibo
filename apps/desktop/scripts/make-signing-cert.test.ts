import { afterAll, beforeAll, expect, test } from "bun:test";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "make-signing-cert.sh");
const PASSWORD = "throwaway-test-password";
const IDENTITY = "Kibo Code Signing";

let workDir = "";
let outDir = "";
let firstRun: ReturnType<typeof runScript>;

function runScript(args: string[], env: Record<string, string> = { KIBO_SIGNING_P12_PASSWORD: PASSWORD }) {
  return Bun.spawnSync(["bash", SCRIPT, ...args], {
    env: { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: workDir, ...env },
    stdin: "ignore",
  });
}

function run(command: string[]) {
  const result = Bun.spawnSync(command, { stdin: "ignore" });
  return { ok: result.exitCode === 0, out: `${result.stdout.toString()}${result.stderr.toString()}` };
}

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "kibo-signing-"));
  outDir = join(workDir, "out");
  firstRun = runScript([outDir]);
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

test("writes a .p12 and a public certificate, never leaves the private key in clear", () => {
  expect(firstRun.exitCode).toBe(0);
  expect(readdirSync(outDir).sort()).toEqual(["kibo-signing.crt", "kibo-signing.p12"]);
  expect(statSync(join(outDir, "kibo-signing.p12")).mode & 0o777).toBe(0o600);
});

test("the certificate is a ten-year P-256 code signing certificate named Kibo Code Signing", () => {
  const cert = join(outDir, "kibo-signing.crt");
  const text = run(["openssl", "x509", "-in", cert, "-noout", "-text"]).out;
  expect(text).toMatch(/Subject: ?CN ?= ?Kibo Code Signing/);
  expect(text).toMatch(/Issuer: ?CN ?= ?Kibo Code Signing/);
  expect(text).toContain("prime256v1");
  expect(text).toMatch(/Extended Key Usage:[^\n]*\n\s*Code Signing/);
  expect(text).toMatch(/Key Usage:[^\n]*\n\s*Digital Signature/);
  const dates = run(["openssl", "x509", "-in", cert, "-noout", "-startdate", "-enddate"]).out;
  const [start, end] = [...dates.matchAll(/=(.+)/g)].map((match) => Date.parse(match[1] ?? ""));
  expect(Math.round(((end ?? 0) - (start ?? 0)) / 86_400_000)).toBe(3650);
});

test("the .p12 opens with the chosen password and holds the key", () => {
  const p12 = join(outDir, "kibo-signing.p12");
  const opened = run(["openssl", "pkcs12", "-in", p12, "-passin", `pass:${PASSWORD}`, "-nodes", "-info"]);
  expect(opened.ok).toBe(true);
  expect(opened.out).toContain("PRIVATE KEY");
  expect(run(["openssl", "pkcs12", "-in", p12, "-passin", "pass:wrong", "-nodes"]).ok).toBe(false);
});

test("prints the two gh secret set commands", () => {
  const out = firstRun.stdout.toString();
  expect(out).toContain("gh secret set MACOS_SIGNING_P12 --repo adbenmc-galadrim/Kibo");
  expect(out).toContain("gh secret set MACOS_SIGNING_P12_PASSWORD --repo adbenmc-galadrim/Kibo");
  expect(out).not.toContain(PASSWORD);
});

test("refuses to write inside a git repository", () => {
  const target = join(import.meta.dir, "signing-must-not-exist");
  const result = runScript([target]);
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("inside a git repository");
  expect(existsSync(target)).toBe(false);
});

test("refuses a non-empty directory, so an existing key is never overwritten", () => {
  const result = runScript([outDir]);
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("not empty");
});

test("asks for an argument and for a password", () => {
  expect(runScript([]).exitCode).toBe(2);
  const noPassword = runScript([join(workDir, "no-password")], {});
  expect(noPassword.exitCode).toBe(1);
  expect(existsSync(join(workDir, "no-password"))).toBe(false);
});

test.skipIf(process.platform !== "darwin" || process.env.CI === "true")(
  "macOS imports the .p12 into a throwaway keychain and codesign signs as Kibo Code Signing",
  () => {
    const keychain = join(workDir, "throwaway.keychain-db");
    const binary = join(workDir, "signed-binary");
    copyFileSync("/bin/echo", binary);
    try {
      expect(run(["security", "create-keychain", "-p", "throwaway", keychain]).ok).toBe(true);
      expect(run(["security", "unlock-keychain", "-p", "throwaway", keychain]).ok).toBe(true);
      const p12 = join(outDir, "kibo-signing.p12");
      const imported = run([
        "security",
        "import",
        p12,
        "-k",
        keychain,
        "-P",
        PASSWORD,
        "-T",
        "/usr/bin/codesign",
      ]);
      expect(imported.out).toContain("1 identity imported");
      const partition = [
        "set-key-partition-list",
        "-S",
        "apple-tool:,apple:,codesign:",
        "-s",
        "-k",
        "throwaway",
      ];
      expect(run(["security", ...partition, keychain]).ok).toBe(true);
      const signed = run(["codesign", "--force", "-s", IDENTITY, "--keychain", keychain, binary]);
      expect(signed.ok).toBe(true);
      expect(run(["codesign", "-dv", "--verbose=2", binary]).out).toContain(`Authority=${IDENTITY}`);
    } finally {
      run(["security", "delete-keychain", keychain]);
    }
    expect(existsSync(keychain)).toBe(false);
  },
  30_000,
);
