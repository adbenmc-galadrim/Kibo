import { expect, test } from "bun:test";
import {
  defaultFields,
  effectiveKey,
  type NewProjectFields,
  preview,
  toRequest,
  validate,
} from "./new-project-model";

const base = (patch: Partial<NewProjectFields> = {}): NewProjectFields => ({
  ...defaultFields("2026-10-16"),
  name: "Emis",
  ...patch,
});

test("defaultFields starts the first sprint on the next Monday, six one-week sprints", () => {
  expect(defaultFields("2026-10-16")).toEqual({
    name: "",
    key: null,
    client: "",
    sprintStart: "2026-10-19",
    sprintCount: 6,
    sprintWeeks: 1,
    folder: "",
  });
  expect(defaultFields("2026-10-19").sprintStart).toBe("2026-10-26");
});

test("effectiveKey derives the key from the name until it is typed", () => {
  expect(effectiveKey(base({ name: "Suivi de chantier" }))).toBe("SC");
  expect(effectiveKey(base({ name: "Emis" }))).toBe("EMI");
  expect(effectiveKey(base({ name: "Emis", key: "EMIS" }))).toBe("EMIS");
});

test("validate accepts a complete form", () => {
  expect(validate(base(), [])).toEqual({ ok: true, key: null, name: false, count: false, start: false });
});

test("validate flags an empty name and an empty key", () => {
  const result = validate(base({ name: "  " }), []);
  expect(result.ok).toBe(false);
  expect(result.name).toBe(true);
  expect(result.key).toBe("empty");
});

test("validate classifies key problems", () => {
  expect(validate(base({ key: "INB" }), []).key).toBe("reserved");
  expect(validate(base({ key: "EMIS" }), ["KIB", "EMIS"]).key).toBe("taken");
  expect(validate(base({ key: "ABCDEFG" }), []).key).toBe("invalid");
  expect(validate(base({ key: "E1" }), []).key).toBe("invalid");
  expect(validate(base({ key: "EMIS" }), ["EMIS"]).ok).toBe(false);
});

test("validate bounds the number of sprints to 1..52", () => {
  expect(validate(base({ sprintCount: 0 }), []).count).toBe(true);
  expect(validate(base({ sprintCount: 53 }), []).count).toBe(true);
  expect(validate(base({ sprintCount: 2.5 }), []).count).toBe(true);
  expect(validate(base({ sprintCount: 52 }), []).count).toBe(false);
});

test("validate refuses a malformed or impossible start date", () => {
  expect(validate(base({ sprintStart: "" }), []).start).toBe(true);
  expect(validate(base({ sprintStart: "19/10/2026" }), []).start).toBe(true);
  expect(validate(base({ sprintStart: "2026-02-30" }), []).start).toBe(true);
  expect(validate(base({ sprintStart: "2028-02-29" }), []).start).toBe(false);
});

test("preview sums up the generated sprints", () => {
  expect(preview(base())).toBe("6 sprints d'une semaine · du 19 oct. au 27 nov. 2026");
  expect(preview(base({ sprintCount: 2, sprintWeeks: 2 }))).toBe(
    "2 sprints de deux semaines · du 19 oct. au 13 nov. 2026",
  );
  expect(preview(base({ sprintCount: 1 }))).toBe("1 sprint d'une semaine · du 19 au 23 oct. 2026");
  expect(preview(base({ sprintStart: "2026-12-28", sprintCount: 2 }))).toBe(
    "2 sprints d'une semaine · du 28 déc. 2026 au 8 janv. 2027",
  );
});

test("preview is empty while the sprint fields are invalid", () => {
  expect(preview(base({ sprintCount: 0 }))).toBe("");
  expect(preview(base({ sprintStart: "" }))).toBe("");
});

test("toRequest builds createProject with the setup", () => {
  expect(
    toRequest(base({ name: " Emis ", key: "EMIS", client: " Emis SA ", folder: " /code/emis " }), "#14B8A6"),
  ).toEqual({
    method: "createProject",
    name: "Emis",
    key: "EMIS",
    client: "Emis SA",
    folder: "/code/emis",
    color: "#14B8A6",
    setup: { sprintStart: "2026-10-19", sprintCount: 6, sprintWeeks: 1 },
  });
});

test("toRequest leaves the client out and the folder null when they are blank", () => {
  const request = toRequest(base({ client: "  ", folder: " " }), "#14B8A6");
  expect(request.folder).toBeNull();
  expect("client" in request).toBe(false);
  expect(request.key).toBe("EMI");
});
