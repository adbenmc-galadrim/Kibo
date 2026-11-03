import { describe, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { parseOptions } from "./options";

describe("parseOptions", () => {
  test("reads the flags", () => {
    const opts = parseOptions(
      [
        "--port",
        "0",
        "--db",
        ":memory:",
        "--origin",
        "https://kibo.shinseo.fr",
        "--setup-code",
        "x",
        "--static",
        "dist",
      ],
      {},
    );
    expect(opts).toEqual({
      port: 0,
      db: ":memory:",
      origin: "https://kibo.shinseo.fr",
      rpId: "kibo.shinseo.fr",
      setupCode: "x",
      staticDir: "dist",
    });
  });

  test("falls back on KIBO_REMOTE_* variables then on defaults", () => {
    const opts = parseOptions([], {
      KIBO_REMOTE_ORIGIN: "https://kibo.shinseo.fr",
      KIBO_REMOTE_SETUP_CODE: "from-env",
      KIBO_REMOTE_DB: "/tmp/r.db",
    });
    expect(opts).toEqual({
      port: 8080,
      db: "/tmp/r.db",
      origin: "https://kibo.shinseo.fr",
      rpId: "kibo.shinseo.fr",
      setupCode: "from-env",
      staticDir: null,
    });
    expect(parseOptions(["--origin", "http://127.0.0.1", "--setup-code", "x"], {}).db).toBe(
      "/data/kibo-remote.db",
    );
  });

  test("flags win over variables", () => {
    const opts = parseOptions(["--port", "9000"], {
      KIBO_REMOTE_PORT: "7000",
      KIBO_REMOTE_ORIGIN: "http://127.0.0.1",
      KIBO_REMOTE_SETUP_CODE: "x",
    });
    expect(opts.port).toBe(9000);
  });

  test("a missing setup code, a bad origin or a bad port is refused", () => {
    const invalid = (argv: string[]) => {
      try {
        parseOptions(argv, {});
      } catch (e) {
        if (!(e instanceof KiboError)) throw e;
        return e.code;
      }
      return null;
    };
    expect(invalid(["--origin", "http://127.0.0.1"])).toBe("INVALID_INPUT");
    expect(invalid(["--origin", "not a url", "--setup-code", "x"])).toBe("INVALID_INPUT");
    expect(invalid(["--origin", "http://127.0.0.1", "--setup-code", "x", "--port", "-1"])).toBe(
      "INVALID_INPUT",
    );
    expect(invalid(["--origin", "http://127.0.0.1", "--setup-code", "x", "--bogus", "1"])).toBe(
      "INVALID_INPUT",
    );
  });
});
