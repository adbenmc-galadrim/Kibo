import { expect, test } from "bun:test";
import { parseGithubRemote } from "./github-remote";

test("github remotes are recognised in every usual form", () => {
  expect(parseGithubRemote("git@github.com:adam/kibo.git")).toBe("adam/kibo");
  expect(parseGithubRemote("https://github.com/adam/kibo")).toBe("adam/kibo");
  expect(parseGithubRemote("https://github.com/adam/kibo.git/")).toBe("adam/kibo");
  expect(parseGithubRemote("https://token@github.com/adam/kibo.git")).toBe("adam/kibo");
  expect(parseGithubRemote("ssh://git@github.com/adam/kibo.js.git")).toBe("adam/kibo.js");
  expect(parseGithubRemote("git@gitlab.com:adam/kibo.git")).toBeNull();
  expect(parseGithubRemote("https://github.com.evil.io/adam/kibo")).toBeNull();
  expect(parseGithubRemote(null)).toBeNull();
});
