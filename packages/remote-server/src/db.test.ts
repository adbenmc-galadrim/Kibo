import { describe, expect, test } from "bun:test";
import { openDb } from "./db";

describe("openDb", () => {
  test("the schema has the seven tables of the plan and the rate limits", () => {
    const db = openDb(":memory:");
    const rows = db
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all();
    expect(rows.map((r) => r.name)).toEqual([
      "account",
      "mac_presence",
      "pair_tokens",
      "passkeys",
      "phone_sessions",
      "rate_limits",
      "snapshots",
      "webauthn_challenges",
    ]);
  });

  test("opening twice keeps the data", () => {
    const path = `${process.env.TMPDIR ?? "/tmp"}/kibo-remote-${crypto.randomUUID()}.db`;
    const first = openDb(path);
    first.run("INSERT INTO mac_presence (id, online, last_seen_at) VALUES (1, 0, 5)");
    first.close();
    const again = openDb(path);
    expect(again.query<{ last_seen_at: number }, []>("SELECT last_seen_at FROM mac_presence").get()).toEqual({
      last_seen_at: 5,
    });
    again.close();
  });
});
