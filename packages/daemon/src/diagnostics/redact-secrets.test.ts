import { expect, test } from "bun:test";
import fc from "fast-check";
import { redactSecrets } from "./redact-secrets";

test("a token assignment is redacted and the rest of the line kept", () => {
  expect(redactSecrets("[kibo-daemon] pair failed token=abc123 at ~/.kibo/x")).toBe(
    "[kibo-daemon] pair failed token=[redacted] at ~/.kibo/x",
  );
  expect(redactSecrets('{"access_token":"gho_x1","code":"NOT_FOUND"}')).toBe(
    '{"access_token":"[redacted]","code":"NOT_FOUND"}',
  );
  expect(redactSecrets("password: hunter22, secret=s3")).toBe("password: [redacted], secret=[redacted]");
});

test("authorization and cookie headers lose their value", () => {
  expect(redactSecrets("Authorization: Bearer abc.def")).toBe("Authorization: [redacted]");
  expect(redactSecrets("set-cookie: kibo_session=xyz; HttpOnly")).toBe("set-cookie: [redacted]");
  expect(redactSecrets("Cookie: a=b")).toBe("Cookie: [redacted]");
  expect(redactSecrets("cookie kibo_session=abc123")).toBe("cookie kibo_session=[redacted]");
  expect(redactSecrets("sent Bearer abc123 to gh")).toBe("sent Bearer [redacted] to gh");
});

test("URL parameters and fragments are dropped, the address kept", () => {
  expect(redactSecrets("open http://127.0.0.1:4317/#pair=deadbeef now")).toBe(
    "open http://127.0.0.1:4317/?[redacted] now",
  );
  expect(redactSecrets("GET https://api.github.com/x?client_secret=1&y=2 failed")).toBe(
    "GET https://api.github.com/x?[redacted] failed",
  );
  expect(redactSecrets("plain https://github.com/a/b")).toBe("plain https://github.com/a/b");
});

test("GitHub tokens are redacted even without a key", () => {
  expect(redactSecrets("bad ghp_0123456789abcdefghijABCDEFGHIJ")).toBe("bad [redacted]");
});

test("a value after token= never survives", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[A-Za-z0-9]{6,40}$/), fc.string(), (secret, tail) => {
      const out = redactSecrets(`x token=${secret} ${tail}`);
      return !out.includes(`token=${secret}`);
    }),
  );
});
