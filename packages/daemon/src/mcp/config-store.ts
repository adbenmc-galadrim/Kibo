import type { Database } from "bun:sqlite";
import { McpServerInput } from "@kibo/schema";
import { z } from "zod";

export type StoredServer = { server: McpServerInput; enabled: boolean; commandLine: string };
type Row = {
  id: string;
  name: string;
  transport: string;
  command: string | null;
  args_json: string;
  env_names_json: string;
  url: string | null;
  bearer: number;
  enabled: number;
  command_line: string;
};
type InsertParams = {
  id: string;
  name: string;
  transport: string;
  command: string | null;
  args: string;
  env: string;
  url: string | null;
  bearer: number;
  line: string;
  at: number;
};
const Strings = z.array(z.string());
const strings = (json: string) => Strings.parse(JSON.parse(json));

function toStored(r: Row): StoredServer {
  const server = McpServerInput.parse(
    r.transport === "stdio"
      ? {
          transport: "stdio",
          id: r.id,
          name: r.name,
          command: r.command,
          args: strings(r.args_json),
          envNames: strings(r.env_names_json),
        }
      : { transport: "http", id: r.id, name: r.name, url: r.url, bearer: r.bearer === 1 },
  );
  return { server, enabled: r.enabled === 1, commandLine: r.command_line };
}

function insertParams(s: McpServerInput, commandLine: string, at: number): InsertParams {
  const stdio = s.transport === "stdio" ? s : null;
  const http = s.transport === "http" ? s : null;
  return {
    id: s.id,
    name: s.name,
    transport: s.transport,
    command: stdio?.command ?? null,
    args: JSON.stringify(stdio?.args ?? []),
    env: JSON.stringify(stdio?.envNames ?? []),
    url: http?.url ?? null,
    bearer: http?.bearer ? 1 : 0,
    line: commandLine,
    at,
  };
}

export function createMcpConfigStore(db: Database) {
  const all = db.query<Row, []>("SELECT * FROM mcp_servers ORDER BY created_at, id");
  const one = db.query<Row, { id: string }>("SELECT * FROM mcp_servers WHERE id = $id");
  const insert = db.query<null, InsertParams>(
    "INSERT INTO mcp_servers (id, name, transport, command, args_json, env_names_json, url, bearer, enabled, command_line, created_at) VALUES ($id, $name, $transport, $command, $args, $env, $url, $bearer, 1, $line, $at)",
  );
  const remove = db.query<null, { id: string }>("DELETE FROM mcp_servers WHERE id = $id");
  const enable = db.query<null, { id: string; enabled: number }>(
    "UPDATE mcp_servers SET enabled = $enabled WHERE id = $id",
  );
  return {
    list: () => all.all().map(toStored),
    get(id: string): StoredServer | null {
      const r = one.get({ id });
      return r ? toStored(r) : null;
    },
    insert(s: McpServerInput, commandLine: string, at: number) {
      insert.run(insertParams(s, commandLine, at));
    },
    remove(id: string) {
      remove.run({ id });
    },
    setEnabled(id: string, enabled: boolean) {
      enable.run({ id, enabled: enabled ? 1 : 0 });
    },
  };
}
export type McpConfigStore = ReturnType<typeof createMcpConfigStore>;
