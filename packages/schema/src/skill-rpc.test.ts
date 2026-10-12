import { expect, test } from "bun:test";
import { SKILL_RPC } from "./skill-rpc";

const schemaOf = (method: string) => {
  const schema = SKILL_RPC.find((s) => s.shape.method.value === method);
  if (!schema) throw new Error(`no schema for ${method}`);
  return schema;
};

const ADDRESSED = ["skills.read", "skills.save", "skills.delete", "skills.assets", "skills.removeAsset"];
const extra = (method: string) =>
  method === "skills.save"
    ? { content: "x", baseHash: null }
    : method === "skills.removeAsset"
      ? { file: "notes.md" }
      : {};

test("every addressed skill method keeps an explicit scope", () => {
  for (const method of ADDRESSED) {
    const base = { method, id: "clean-pr", ...extra(method) };
    const project = schemaOf(method).parse({ ...base, scope: "project", projectId: "kibo" });
    expect(project).toMatchObject({ scope: "project", projectId: "kibo" });
    const plugin = schemaOf(method).parse({ ...base, scope: "plugin", plugin: "superpowers" });
    expect(plugin).toMatchObject({ scope: "plugin", plugin: "superpowers" });
    expect(schemaOf(method).safeParse(base).success).toBe(true);
    expect(schemaOf(method).safeParse({ ...base, scope: "team" }).success).toBe(false);
  }
});
