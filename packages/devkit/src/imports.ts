import { dirname, normalize } from "node:path/posix";
import { isEmbeddedSpecifier, SERVER_SPECIFIERS, SHARED_SPECIFIERS, TEST_SPECIFIERS } from "@kibo/schema";
import type * as TS from "typescript";
import { issueAt, type SourceIssue } from "./issues";
import type { TypeScript } from "./typescript";

const BANNED = new Set([
  "require",
  "eval",
  "Function",
  "process",
  "Bun",
  "globalThis",
  "global",
  "self",
  "module",
  "Worker",
  "SharedWorker",
]);
const IMPORT_ATTRIBUTES = "import attributes";
const isTest = (path: string) => /\.test\.tsx?$/.test(path);
const SERVER_FILES = new Set(["server.ts", "migrations.ts"]);
const isServerFile = (path: string) => SERVER_FILES.has(path);

function allowedFor(path: string): Set<string> {
  return new Set([
    ...SHARED_SPECIFIERS,
    "react/jsx-dev-runtime",
    ...SERVER_SPECIFIERS,
    ...(isTest(path) ? TEST_SPECIFIERS : []),
  ]);
}

function isValueIdentifier(ts: TypeScript, node: TS.Identifier): boolean {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  if (ts.isShorthandPropertyAssignment(parent)) return true;
  if (ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent) || ts.isPropertySignature(parent)) {
    return parent.name !== node;
  }
  if (ts.isTypeReferenceNode(parent) || ts.isQualifiedName(parent)) return false;
  return true;
}

function checkFile(ts: TypeScript, file: { path: string; text: string }, issues: SourceIssue[]): void {
  const kind = file.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, kind);
  const allowed = allowedFor(file.path);
  const report = (node: TS.Node, code: SourceIssue["code"], detail: string) => {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    issues.push(issueAt(file.path, line, code, detail));
  };
  const check = (spec: string, node: TS.Node) => {
    if (spec.startsWith(".")) {
      if (normalize(`${dirname(file.path)}/${spec}`).startsWith("..")) report(node, "outside-import", spec);
      return;
    }
    const embedded = !isServerFile(file.path) && isEmbeddedSpecifier(spec);
    if (!allowed.has(spec) && !embedded) report(node, "forbidden-import", spec);
  };
  const visit = (node: TS.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (node.attributes) report(node, "banned-identifier", IMPORT_ATTRIBUTES);
      else if (ts.isStringLiteral(node.moduleSpecifier)) check(node.moduleSpecifier.text, node);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [arg, attributes] = node.arguments;
      if (attributes) report(node, "banned-identifier", IMPORT_ATTRIBUTES);
      else if (arg && ts.isStringLiteralLike(arg)) check(arg.text, node);
      else report(node, "non-literal-import", node.getText(source));
    } else if (ts.isImportEqualsDeclaration(node)) {
      report(node, "banned-identifier", "import =");
    } else if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) {
      report(node, "banned-identifier", "import.meta");
    } else if (ts.isIdentifier(node) && BANNED.has(node.text) && isValueIdentifier(ts, node)) {
      report(node, "banned-identifier", node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

export function checkImports(ts: TypeScript, files: { path: string; text: string }[]): SourceIssue[] {
  const issues: SourceIssue[] = [];
  for (const file of files) checkFile(ts, file, issues);
  return issues;
}
