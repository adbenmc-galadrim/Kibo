import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { DaemonRunning } from "./single-instance";
import { fatalLine, REUSED_EXIT_CODE, reuseLines } from "./startup-lines";

const running = { info: { port: 4317, sandboxPort: 4318, pid: 777 }, answers: true };

test("reuse lines announce the running daemon exactly like a fresh start, after KIBO_REUSED", () => {
  expect(reuseLines(running, "abc")).toBe(
    "KIBO_REUSED\nKIBO_READY http://127.0.0.1:4317/#pair=abc\nKIBO_SANDBOX http://127.0.0.1:4318\n",
  );
  expect(REUSED_EXIT_CODE).toBe(3);
});

test("the fatal line carries the code and a one-line detail", () => {
  expect(fatalLine(new DaemonRunning("/h", { ...running, answers: false }))).toBe(
    "KIBO_FATAL DAEMON_RUNNING another daemon (pid 777) holds /h at http://127.0.0.1:4317 and does not answer\n",
  );
  expect(fatalLine(new KiboError("STORE_CORRUPT", "cannot open\n  kibo.db:\tbad"))).toBe(
    "KIBO_FATAL STORE_CORRUPT cannot open kibo.db: bad\n",
  );
  expect(fatalLine(new Error("boom"))).toBe("KIBO_FATAL INTERNAL boom\n");
  expect(fatalLine("plain")).toBe("KIBO_FATAL INTERNAL plain\n");
});
