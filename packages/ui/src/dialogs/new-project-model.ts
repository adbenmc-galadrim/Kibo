import {
  type IsoDate,
  nextMonday,
  ProjectKey,
  type ProjectSetup,
  RESERVED_PROJECT_KEYS,
  type RpcRequest,
  SPRINT_COUNT_MAX,
  SprintDate,
  sprintPlanEnd,
} from "@kibo/schema";
import { frNewProject as t } from "../i18n/fr-new-project";
import { suggestProjectKey } from "../lib/project-key";

export type NewProjectFields = {
  name: string;
  key: string | null;
  client: string;
  sprintStart: string;
  sprintCount: number;
  sprintWeeks: 1 | 2;
  folder: string;
};

export type KeyProblem = "empty" | "invalid" | "reserved" | "taken";

export type Validation = {
  ok: boolean;
  key: KeyProblem | null;
  name: boolean;
  count: boolean;
  start: boolean;
};

type CreateProjectRequest = Extract<RpcRequest, { method: "createProject" }>;

const DEFAULT_SPRINT_COUNT = 6;

export const defaultFields = (today: IsoDate): NewProjectFields => ({
  name: "",
  key: null,
  client: "",
  sprintStart: nextMonday(today),
  sprintCount: DEFAULT_SPRINT_COUNT,
  sprintWeeks: 1,
  folder: "",
});

export const effectiveKey = (fields: NewProjectFields): string =>
  fields.key ?? suggestProjectKey(fields.name);

function keyProblem(key: string, existingKeys: readonly string[]): KeyProblem | null {
  if (key === "") return "empty";
  if (!ProjectKey.safeParse(key).success) return "invalid";
  if (RESERVED_PROJECT_KEYS.includes(key)) return "reserved";
  if (existingKeys.includes(key)) return "taken";
  return null;
}

const isRealDate = (date: string): boolean =>
  SprintDate.safeParse(date).success && new Date(`${date}T00:00:00Z`).toISOString().startsWith(date);

const countOk = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= SPRINT_COUNT_MAX;

export function validate(fields: NewProjectFields, existingKeys: readonly string[]): Validation {
  const key = keyProblem(effectiveKey(fields), existingKeys);
  const name = fields.name.trim() === "";
  const count = !countOk(fields.sprintCount);
  const start = !isRealDate(fields.sprintStart);
  return { ok: key === null && !name && !count && !start, key, name, count, start };
}

const setupOf = (fields: NewProjectFields): ProjectSetup => ({
  sprintStart: fields.sprintStart,
  sprintCount: fields.sprintCount,
  sprintWeeks: fields.sprintWeeks,
});

const parts = (date: string) => {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return { year, month: month - 1, day };
};

function dateSpan(start: string, end: string): string {
  const a = parts(start);
  const b = parts(end);
  const last = `${b.day} ${t.month(b.month)} ${b.year}`;
  if (a.year !== b.year) return t.range(`${a.day} ${t.month(a.month)} ${a.year}`, last);
  if (a.month !== b.month) return t.range(`${a.day} ${t.month(a.month)}`, last);
  return t.range(String(a.day), last);
}

export function preview(fields: NewProjectFields): string {
  if (!countOk(fields.sprintCount) || !isRealDate(fields.sprintStart)) return "";
  const setup = setupOf(fields);
  return t.summary(
    t.count(setup.sprintCount, setup.sprintWeeks),
    dateSpan(setup.sprintStart, sprintPlanEnd(setup)),
  );
}

export function toRequest(fields: NewProjectFields, color: string): CreateProjectRequest {
  const client = fields.client.trim();
  return {
    method: "createProject",
    name: fields.name.trim(),
    key: effectiveKey(fields),
    ...(client ? { client } : {}),
    folder: fields.folder.trim() || null,
    color,
    setup: setupOf(fields),
  };
}
