import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BuiltinEntityType, COMMAND_WRITES, type ProjectCommand } from "@kibo/schema";
import type * as TS from "typescript";
import { listSourceFiles } from "./hash";
import { issueAt, type SourceIssue } from "./issues";
import type { Toolchain } from "./toolchain";
import { loadTypeScript, type TypeScript } from "./typescript";

export type Inference = { used: string[]; issues: SourceIssue[] };

type SourceText = { path: string; text: string };

const RECEIVERS = new Set(["sdk", "ctx"]);
const NOTE_READS = new Set(["read", "search", "info"]);
const NOTE_WRITES = new Set(["write", "rename", "remove"]);
const MCP_METHODS = new Set(["call", "read", "importItem"]);
const isTest = (path: string) => /\.test\.tsx?$/.test(path);
const isCommandMethod = (method: string): method is ProjectCommand["method"] =>
  Object.hasOwn(COMMAND_WRITES, method);

function chain(ts: TypeScript, expr: TS.Expression): string[] | null {
  if (ts.isIdentifier(expr)) return RECEIVERS.has(expr.text) ? [expr.text] : null;
  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === "useSdk")
    return ["sdk"];
  if (ts.isPropertyAccessExpression(expr)) {
    const head = chain(ts, expr.expression);
    return head ? [...head, expr.name.text] : null;
  }
  return null;
}

function literal(ts: TypeScript, node: TS.Node | undefined): string | null {
  return node && ts.isStringLiteralLike(node) ? node.text : null;
}

function methodOf(ts: TypeScript, arg: TS.Expression | undefined): string | null {
  if (!arg || !ts.isObjectLiteralExpression(arg)) return null;
  const prop = arg.properties.find(
    (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === "method",
  );
  return prop && ts.isPropertyAssignment(prop) ? literal(ts, prop.initializer) : null;
}

function inferFile(ts: TypeScript, file: SourceText, used: Set<string>, issues: SourceIssue[]): void {
  const kind = file.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, kind);
  const report = (node: TS.Node, code: SourceIssue["code"], detail: string) => {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    issues.push(issueAt(file.path, line, code, detail));
  };
  const nonLiteral = (call: TS.CallExpression) => report(call, "non-literal-argument", call.getText(source));
  const entity = (call: TS.CallExpression, prefix: "read" | "write") => {
    const value = literal(ts, call.arguments[0]);
    if (value === null) return nonLiteral(call);
    if (!BuiltinEntityType.safeParse(value).success) return report(call, "unknown-entity", value);
    used.add(`${prefix}:${value}`);
  };
  const run = (call: TS.CallExpression) => {
    const method = methodOf(ts, call.arguments[0]);
    if (method === null) return nonLiteral(call);
    if (!isCommandMethod(method)) return report(call, "unknown-entity", method);
    const target = COMMAND_WRITES[method];
    if (target === null) return report(call, "reserved-command", method);
    used.add(`write:${target}`);
  };
  const fetch = (call: TS.CallExpression) => {
    const url = literal(ts, call.arguments[0]);
    if (url === null) return nonLiteral(call);
    used.add(`net:${url}`);
  };
  const mcp = (call: TS.CallExpression, method: string | undefined) => {
    if (!method || !MCP_METHODS.has(method)) return;
    if (method === "importItem") used.add("write:ticket");
    const server = literal(ts, call.arguments[0]);
    if (server === null) return nonLiteral(call);
    if (method !== "call") return void used.add(`mcp:${server}`);
    const tool = literal(ts, call.arguments[1]);
    if (tool === null) return nonLiteral(call);
    used.add(`mcp:${server}/${tool}`);
  };
  const sdkCall = (call: TS.CallExpression, path: string[]) => {
    const [, first, second] = path;
    if (path.length === 2 && first === "list") entity(call, "read");
    else if (path.length === 2 && first === "run") run(call);
    else if (path.length === 2 && first === "fetch") fetch(call);
    else if (path.length === 3 && first === "data") used.add("data");
    else if (path.length === 3 && first === "notes" && second && NOTE_READS.has(second))
      used.add("read:note");
    else if (path.length === 3 && first === "notes" && second && NOTE_WRITES.has(second))
      used.add("write:note");
    else if (path.length === 3 && first === "mcp") mcp(call, second);
  };
  const visit = (node: TS.Node): void => {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === "useEntities") entity(node, "read");
      const path = chain(ts, node.expression);
      if (path) sdkCall(node, path);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

export function inferFromSources(ts: TypeScript, files: SourceText[]): Inference {
  const used = new Set<string>();
  const issues: SourceIssue[] = [];
  for (const file of files) if (!isTest(file.path)) inferFile(ts, file, used, issues);
  return { used: [...used], issues };
}

export async function inferPermissions(dir: string, toolchain: Toolchain): Promise<Inference> {
  const ts = await loadTypeScript(toolchain);
  const paths = (await listSourceFiles(dir)).filter((p) => /\.tsx?$/.test(p));
  const files = await Promise.all(
    paths.map(async (path) => ({ path, text: await readFile(join(dir, path), "utf8") })),
  );
  return inferFromSources(ts, files);
}
