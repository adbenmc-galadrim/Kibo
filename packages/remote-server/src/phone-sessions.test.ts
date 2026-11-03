import { describe, expect, test } from "bun:test";
import { openDb } from "./db";
import { createSession } from "./phone-sessions";

describe("sessions", () => {
  test("creating a session purges the expired ones", () => {
    const db = openDb(":memory:");
    createSession(db, 0);
    createSession(db, 91 * 24 * 3_600_000);
    expect(db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM phone_sessions").get()?.n).toBe(1);
  });
});
