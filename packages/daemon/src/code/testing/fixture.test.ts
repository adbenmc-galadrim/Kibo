import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import {
  createGitFixture,
  type GitFixture,
  installFakeBin,
  installFakeGh,
  readFakeBinLog,
  readFakeGhLog,
} from "./git-fixture";

let fx: GitFixture;
beforeEach(() => {
  fx = createGitFixture();
});
afterEach(() => fx.cleanup());

test("the fixture has an isolated identity and a bare remote", () => {
  const sha = fx.commit("chore: init", { "README.md": "# test\n" });
  expect(sha).toMatch(/^[0-9a-f]{40}$/);
  expect(fx.git("log", "-1", "--format=%an <%ae>").trim()).toBe("Adam <adam@example.test>");
  expect(fx.git("config", "user.email").trim()).toBe("adam@example.test");
  expect(fx.git("config", "commit.gpgsign").trim()).toBe("false");
  fx.git("push", "-q", "origin", "main");
  expect(fx.git("ls-remote", "origin").trim()).toContain("refs/heads/main");
});

test("cleanup removes the temporary directory", () => {
  const other = createGitFixture({ remote: false });
  other.cleanup();
  expect(existsSync(other.dir)).toBe(false);
});

test("the fake gh records calls and creates numbered PRs", () => {
  const env = installFakeGh(fx.dir);
  const gh = env.KIBO_GH ?? "";
  const create = Bun.spawnSync([gh, "pr", "create", "--head=kib-12", "--body-file", "-"], {
    env: { ...process.env, ...env },
    stdin: new TextEncoder().encode("corps"),
  });
  expect(create.stdout.toString().trim()).toBe("https://github.com/kibo/test/pull/1");
  const view = Bun.spawnSync([gh, "pr", "view", "kib-12", "--json", "number,url,state,isDraft"], {
    env: { ...process.env, ...env },
  });
  expect(JSON.parse(view.stdout.toString())).toMatchObject({ number: 1, state: "OPEN" });
  expect(readFakeGhLog(env)[0]).toEqual({
    args: ["pr", "create", "--head=kib-12", "--body-file", "-"],
    stdin: "corps",
  });
});

test("a fake binary logs its arguments", () => {
  const bin = installFakeBin(fx.dir, "code");
  Bun.spawnSync([bin.path, "--goto", "a.ts:3"], { env: { ...process.env, FAKE_BIN_LOG: bin.log } });
  expect(readFakeBinLog(bin.log)).toEqual([["--goto", "a.ts:3"]]);
});
