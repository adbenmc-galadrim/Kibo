import { expect, test } from "bun:test";
import { existsSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { VERSIONS_PER_FILE } from "@kibo/schema";
import { createFileHistory, type DepositInput } from "./file-history";
import { contentHash } from "./guarded-write";
import { makeTestHome } from "./test-home.test-helper";

const deposit = (content: string, extra: Partial<DepositInput> = {}): DepositInput => ({
  kind: "agents",
  ref: "global:a",
  file: "agent.md",
  content,
  origin: "kibo",
  by: "adam",
  note: null,
  ...extra,
});

const setup = () => {
  const h = makeTestHome();
  let clock = 1_000;
  const history = createFileHistory({ home: h.kiboHome, db: h.db, now: () => clock++ });
  return { h, history };
};

test("a deposit writes a private file under history and a row", () => {
  const { h, history } = setup();
  const v = history.deposit(deposit("v1"));
  const path = join(
    h.kiboHome,
    "history",
    "agents",
    "global",
    "a",
    "agent.md",
    `1000-${contentHash("v1").slice(0, 8)}`,
  );
  expect(existsSync(path)).toBe(true);
  expect(statSync(path).mode & 0o777).toBe(0o600);
  expect(v).toMatchObject({ ref: "global:a", file: "agent.md", hash: contentHash("v1"), size: 2, at: 1000 });
  expect(v.missing).toBe(false);
  expect(history.read(v.id)?.content).toBe("v1");
});

test("project refs and skill files get their own folders", () => {
  const { h, history } = setup();
  history.deposit(deposit("x", { kind: "skills", ref: "project:p1:deploy", file: "scripts/run.sh" }));
  expect(existsSync(join(h.kiboHome, "history", "skills", "project-p1", "deploy", "scripts__run.sh"))).toBe(
    true,
  );
});

test("the list goes from the newest to the oldest", () => {
  const { history } = setup();
  for (const c of ["v1", "v2", "v3"]) history.deposit(deposit(c));
  expect(history.list("agents", "global:a").map((v) => history.read(v.id)?.content)).toEqual([
    "v3",
    "v2",
    "v1",
  ]);
  expect(history.list("agents", "global:a", "other.md")).toEqual([]);
  expect(history.latest("agents", "global:a", "agent.md")?.hash).toBe(contentHash("v3"));
});

test("beyond 100 versions the oldest leaves, file and row", () => {
  const { h, history } = setup();
  const first = history.deposit(deposit("v0"));
  for (let i = 1; i <= VERSIONS_PER_FILE; i++) history.deposit(deposit(`v${i}`));
  expect(history.list("agents", "global:a")).toHaveLength(VERSIONS_PER_FILE);
  expect(history.read(first.id)).toBeNull();
  const dir = join(h.kiboHome, "history", "agents", "global", "a", "agent.md");
  expect(existsSync(join(dir, `1000-${contentHash("v0").slice(0, 8)}`))).toBe(false);
});

test("a version whose file is gone reads as missing", () => {
  const { h, history } = setup();
  const v = history.deposit(deposit("v1"));
  rmSync(join(h.kiboHome, "history"), { recursive: true });
  expect(history.read(v.id)).toMatchObject({ content: null, version: { missing: true } });
});

test("hasHash and at most one external version per hash", () => {
  const { history } = setup();
  expect(history.hasHash("agents", "global:a", "agent.md", contentHash("v1"))).toBe(false);
  history.deposit(deposit("v1", { origin: "external" }));
  history.deposit(deposit("v1", { origin: "external" }));
  expect(history.hasHash("agents", "global:a", "agent.md", contentHash("v1"))).toBe(true);
  expect(history.list("agents", "global:a")).toHaveLength(1);
});
