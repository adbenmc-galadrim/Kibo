import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { Glob } from "bun";
import { assertTicketExecution, isTicketRun, refuseTicketExecution } from "./execution-removed";

test("only a run tied to a ticket is a ticket run", () => {
  expect(isTicketRun({ kind: "ticket", ticketId: "t1" })).toBe(true);
  expect(isTicketRun({ kind: "ticket", ticketId: null })).toBe(false);
  expect(isTicketRun({ kind: "project", ticketId: null })).toBe(false);
});

test("the refusal carries the stable code and names what was refused", () => {
  const refused = (() => {
    try {
      refuseTicketExecution("deliver");
    } catch (e) {
      return e;
    }
    return null;
  })();
  expect(refused).toBeInstanceOf(KiboError);
  expect(refused).toMatchObject({ code: "AGENT_EXECUTION_REMOVED" });
  expect(refused instanceof KiboError && refused.detail.startsWith("deliver: ")).toBe(true);
});

test("only an explicit allowed mode lets ticket execution through", () => {
  expect(() => assertTicketExecution("removed", "assign")).toThrow("AGENT_EXECUTION_REMOVED");
  expect(() => assertTicketExecution("allowed", "assign")).not.toThrow();
});

const SRC = join(import.meta.dir, "..");
const productionFiles = (): string[] =>
  [...new Glob("**/*.ts").scanSync(SRC)].filter(
    (f) => !/\.(test|int\.test|integration\.test|test-helper)\.ts$/.test(f) && !f.startsWith("testing/"),
  );

test("no production source can turn ticket execution on", () => {
  const files = productionFiles();
  expect(files).toContain("main.ts");
  for (const file of files) {
    const text = readFileSync(join(SRC, file), "utf8");
    expect({ file, set: /ticketExecution\??:\s*"allowed"/.test(text) }).toEqual({ file, set: false });
    expect({ file, read: /(process\.env|argv|values)\S*\.ticketExecution/i.test(text) }).toEqual({
      file,
      read: false,
    });
  }
  for (const file of ["main.ts", "daemon-options.ts", "daemon.ts", "daemon-agents.ts"]) {
    const text = readFileSync(join(SRC, file), "utf8");
    expect({ file, allowed: text.includes('"allowed"') }).toEqual({ file, allowed: false });
  }
  expect(readFileSync(join(SRC, "main.ts"), "utf8")).not.toContain("ticketExecution");
});
