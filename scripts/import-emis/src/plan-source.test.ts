import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { flatPrs, loadAnswers, loadPlan } from "./plan-source";

const FIXTURE = join(import.meta.dir, "..", "fixtures", "emis");
const PLAN_FILE = join(FIXTURE, "tmp", "plan-data.js");
const tmpDir = () => mkdtempSync(join(tmpdir(), "import-emis-plan-"));

test("the plan file is evaluated in an empty window and validated", () => {
  const plan = loadPlan(PLAN_FILE);
  expect(plan.chapters.map((c) => c.id)).toEqual(["C0", "C1"]);
  expect(flatPrs(plan)).toHaveLength(6);
  expect(flatPrs(plan).find((p) => p.id === "C1-2")?.chapter).toBe("C1");
  expect(flatPrs(plan).find((p) => p.id === "C0-1")).toMatchObject({ deps: [], perimetre: [] });
});

test("a file that is not a plan is refused", () => {
  const file = join(tmpDir(), "plan-data.js");
  writeFileSync(file, "window.PLAN_DATA = { meta: {} }");
  expect(() => loadPlan(file)).toThrow(KiboError);
  writeFileSync(file, "require('fs')");
  expect(() => loadPlan(file)).toThrow();
  writeFileSync(file, "while (true) {}");
  expect(() => loadPlan(file)).toThrow();
});

test("an unknown status is refused at load time", () => {
  const file = join(tmpDir(), "plan-data.js");
  writeFileSync(file, readFileSync(PLAN_FILE, "utf8").replace('status: "todo"', 'status: "someday"'));
  expect(() => loadPlan(file)).toThrow(/status/);
});

test("answers merge over resolved", () => {
  expect(loadAnswers(join(FIXTURE, "tmp", "reponses.json"))).toMatchObject({ Q3: { status: "answered" } });
  expect(loadAnswers(join(FIXTURE, "tmp", "absent.json"))).toEqual({});
});
