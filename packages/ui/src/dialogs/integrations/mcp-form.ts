import { McpServerInput } from "@kibo/schema";

export type EnvVar = { key: string; name: string; value: string };

export type McpForm = {
  transport: "stdio" | "http";
  id: string;
  name: string;
  command: string;
  args: string;
  env: EnvVar[];
  url: string;
  bearer: string;
};

export type McpFormResult = { server: McpServerInput; secrets: Record<string, string> } | { error: string };

export function slugId(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

const lines = (text: string) =>
  text
    .split("\n")
    .map((a) => a.trim())
    .filter((a) => a !== "");

function rawServer(form: McpForm, env: McpForm["env"]) {
  if (form.transport === "stdio") {
    return {
      transport: "stdio" as const,
      id: form.id,
      name: form.name,
      command: form.command,
      args: lines(form.args),
      envNames: env.map((e) => e.name.trim()),
    };
  }
  return {
    transport: "http" as const,
    id: form.id,
    name: form.name,
    url: form.url,
    bearer: form.bearer !== "",
  };
}

function secretsOf(form: McpForm, env: McpForm["env"]): Record<string, string> {
  if (form.transport === "stdio") return Object.fromEntries(env.map((e) => [e.name.trim(), e.value]));
  return form.bearer ? { bearer: form.bearer } : {};
}

export function toServerInput(form: McpForm): McpFormResult {
  const env = form.env.filter((e) => e.name.trim() !== "");
  const parsed = McpServerInput.safeParse(rawServer(form, env));
  if (!parsed.success) return { error: String(parsed.error.issues[0]?.path[0] ?? "id") };
  return { server: parsed.data, secrets: secretsOf(form, env) };
}
