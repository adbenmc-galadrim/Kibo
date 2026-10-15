import { expect, test } from "bun:test";
import { cleanEnv } from "./agents/child-env";
import {
  LOGIN_PATH_MARKERS,
  LOGIN_PATH_TIMEOUT_MS,
  type LoginShellRun,
  type LoginShellRunner,
  loginShellPath,
  looksLikeLaunchdPath,
  mergePaths,
} from "./login-path";

const LAUNCHD = "/usr/bin:/bin:/usr/sbin:/sbin";
const NVM = "/Users/adam/.nvm/versions/node/v24.14.1/bin";
const LOGIN = `${NVM}:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin`;

const printing =
  (output: string, seen: LoginShellRun[] = []): LoginShellRunner =>
  async (run) => {
    seen.push(run);
    const stdout = output
      .replace("<start>", LOGIN_PATH_MARKERS.start)
      .replace("<end>", LOGIN_PATH_MARKERS.end);
    return { code: 0, stdout, timedOut: false };
  };

const DARWIN: NodeJS.Platform = "darwin";
const LINUX: NodeJS.Platform = "linux";

const options = (patch: Partial<Parameters<typeof loginShellPath>[0]> = {}) => {
  const logs: string[] = [];
  return {
    logs,
    opts: {
      platform: DARWIN,
      env: { PATH: LAUNCHD, SHELL: "/bin/zsh" },
      run: printing(`motd noise\n<start>${LOGIN}<end>\nbye`),
      log: (line: string) => logs.push(line),
      ...patch,
    },
  };
};

test("only the bare launchd PATH, or no PATH, is taken as launchd's", () => {
  expect(looksLikeLaunchdPath(LAUNCHD)).toBe(true);
  expect(looksLikeLaunchdPath("/usr/bin:/bin")).toBe(true);
  expect(looksLikeLaunchdPath(undefined)).toBe(true);
  expect(looksLikeLaunchdPath(`${NVM}:${LAUNCHD}`)).toBe(false);
  expect(looksLikeLaunchdPath("/opt/homebrew/bin:/usr/bin")).toBe(false);
});

test("the login PATH goes in front of the current one, without duplicates", () => {
  expect(mergePaths(LOGIN, `${LAUNCHD}:/extra`)).toBe(`${LOGIN}:/extra`);
  expect(mergePaths("/a::/b:/a", "/b:/c")).toBe("/a:/b:/c");
});

test("under launchd on macOS the login shell PATH is read between markers, once, and logged", async () => {
  const seen: LoginShellRun[] = [];
  const { logs, opts } = options({ run: printing(`noise\n<start>${LOGIN}<end>`, seen) });
  expect(await loginShellPath(opts)).toBe(LOGIN);
  expect(seen).toHaveLength(1);
  expect(seen[0]).toMatchObject({ shell: "/bin/zsh", timeoutMs: LOGIN_PATH_TIMEOUT_MS });
  expect(seen[0]?.args).toEqual(["-ilc", seen[0]?.script ?? ""]);
  expect(logs).toEqual([`[kibo-daemon] PATH completed from the login shell: ${LOGIN}`]);
});

test("a terminal PATH, or another platform, is left alone without starting a shell", async () => {
  for (const patch of [{ env: { PATH: `${NVM}:${LAUNCHD}`, SHELL: "/bin/zsh" } }, { platform: LINUX }]) {
    const seen: LoginShellRun[] = [];
    const { logs, opts } = options({ ...patch, run: printing(`<start>${LOGIN}<end>`, seen) });
    expect(await loginShellPath(opts)).toBeNull();
    expect(seen).toEqual([]);
    expect(logs).toEqual([]);
  }
});

test("rc noise and a non-zero exit do not hide a printed PATH", async () => {
  const run: LoginShellRunner = async () => ({
    code: 1,
    stdout: `compinit: insecure directories\n${LOGIN_PATH_MARKERS.start}${LOGIN}${LOGIN_PATH_MARKERS.end}`,
    timedOut: false,
  });
  expect(await loginShellPath(options({ run }).opts)).toBe(LOGIN);
});

test("a failing, late or silent login shell keeps the current PATH and says why", async () => {
  const outcomes: Awaited<ReturnType<LoginShellRunner>>[] = [
    { code: 1, stdout: "", timedOut: false },
    { code: 137, stdout: "", timedOut: true },
    { code: 0, stdout: "no markers here", timedOut: false },
  ];
  for (const outcome of outcomes) {
    const { logs, opts } = options({ run: async () => outcome });
    expect(await loginShellPath(opts)).toBeNull();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain("keeping");
  }
  const { logs, opts } = options({
    run: async () => {
      throw new Error("spawn failed");
    },
  });
  expect(await loginShellPath(opts)).toBeNull();
  expect(logs[0]).toContain("spawn failed");
});

test("without SHELL the user's login shell is used, and cleanEnv keeps PATH", async () => {
  const seen: LoginShellRun[] = [];
  const { opts } = options({
    env: { PATH: LAUNCHD },
    run: printing(`<start>${LOGIN}<end>`, seen),
    userShell: "/bin/bash",
  });
  await loginShellPath(opts);
  expect(seen[0]?.shell).toBe("/bin/bash");
  expect(cleanEnv({ PATH: LOGIN }).PATH).toBe(LOGIN);
});
