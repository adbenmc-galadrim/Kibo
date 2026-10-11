import { afterEach, expect, spyOn, test } from "bun:test";
import { signalGroup, tryKill } from "./process-group";

const systemError = (code: string) => Object.assign(new Error(`kill() failed: ${code}`), { code });

const failKill = (code: string) =>
  spyOn(process, "kill").mockImplementation(() => {
    throw systemError(code);
  });

afterEach(() => {
  spyOn(process, "kill").mockRestore();
  spyOn(console, "error").mockRestore();
});

test("signalGroup signals the negative pid and reports success", () => {
  const kill = spyOn(process, "kill").mockImplementation(() => true);
  expect(signalGroup(1234, "SIGTERM")).toBe(true);
  expect(kill).toHaveBeenCalledWith(-1234, "SIGTERM");
});

test("signalGroup treats a missing group as gone", () => {
  failKill("ESRCH");
  expect(signalGroup(1234, "SIGKILL")).toBe(false);
});

test("signalGroup treats a refused group as gone", () => {
  failKill("EPERM");
  expect(signalGroup(1234, "SIGKILL")).toBe(false);
});

test("signalGroup rethrows any other failure", () => {
  failKill("EINVAL");
  expect(() => signalGroup(1234, "SIGKILL")).toThrow("EINVAL");
});

test("tryKill logs a failing kill instead of throwing", () => {
  const log = spyOn(console, "error").mockImplementation(() => {});
  expect(() =>
    tryKill("killing group 1234", () => {
      throw systemError("EINVAL");
    }),
  ).not.toThrow();
  expect(log).toHaveBeenCalledTimes(1);
  expect(String(log.mock.calls[0]?.[0])).toContain("killing group 1234");
});
