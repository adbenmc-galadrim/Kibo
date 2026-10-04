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
  expect(redactSecrets("secret=s3 then")).toBe("secret=[redacted] then");
});

test("keys written with dashes or other names are redacted", () => {
  expect(redactSecrets("x-api-key: abc123")).toBe("x-api-key: [redacted]");
  expect(redactSecrets("api-key=abc123 sent")).toBe("api-key=[redacted] sent");
  expect(redactSecrets("ACCESS_KEY=abc123")).toBe("ACCESS_KEY=[redacted]");
  expect(redactSecrets("private-key: abc123")).toBe("private-key: [redacted]");
  expect(redactSecrets("credentials=abc123")).toBe("credentials=[redacted]");
  expect(redactSecrets("auth=abc123")).toBe("auth=[redacted]");
});

test("credentials inside a URL are redacted", () => {
  expect(redactSecrets("clone https://user:pw123@host/x failed")).toBe(
    "clone https://[redacted]@host/x failed",
  );
});

test("bare provider keys are redacted", () => {
  expect(redactSecrets("key sk-ant-api03-AbCdEfGhIjKlMnOpQrStUv_wx-yz rejected")).toBe(
    "key [redacted] rejected",
  );
});

test("Basic and Token schemes with a long value are redacted", () => {
  expect(redactSecrets("sent Basic dXNlcjpwYXNzd29yZDEyMw== to x")).toBe("sent Basic [redacted] to x");
  expect(redactSecrets("sent Token 0123456789abcdef0123 to x")).toBe("sent Token [redacted] to x");
});

test("a password is redacted up to the end of the line", () => {
  expect(redactSecrets("password: my secret phrase\nnext")).toBe("password: [redacted]\nnext");
  expect(redactSecrets("db passwd=hunter22, retry")).toBe("db passwd=[redacted]");
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

test("ordinary text without secrets is left untouched", () => {
  const word = fc.oneof(
    fc.stringMatching(/^[a-zA-Zàéèçô]{1,12}$/),
    fc.constantFrom("token", "Token", "authorisation", "password", "Basic", "clé", "secret", "auteur"),
  );
  fc.assert(
    fc.property(fc.array(word, { maxLength: 12 }), (words) => {
      const line = words.join(" ");
      return redactSecrets(line) === line;
    }),
  );
});
