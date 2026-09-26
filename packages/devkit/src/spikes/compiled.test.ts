import { afterAll, expect, test } from "bun:test";
import { closeSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compileBinary, REPO, tempDir } from "./spike-kit";

const tmp = tempDir("kibo-spike-c-");
afterAll(tmp.dispose);

test("tailwind and typescript load from the toolchain inside a compiled binary", async () => {
  const entry = join(tmp.dir, "probe.ts");
  writeFileSync(
    entry,
    `import { join } from "node:path";
import { compileCss } from ${JSON.stringify(join(REPO, "packages/devkit/src/tailwind.ts"))};
const [src, root] = process.argv.slice(2);
const css = await compileCss({ css: '@import "tailwindcss";', sources: [src], toolchain: { root } });
const ts = await import(Bun.resolveSync("typescript", root));
const program = ts.createProgram([join(src, "ok.ts")], { noEmit: true, strict: true, target: 9, types: [] });
console.log(JSON.stringify({ css: css.includes(".bg-emerald-500"), diagnostics: ts.getPreEmitDiagnostics(program).length }));
`,
  );
  writeFileSync(join(tmp.dir, "ui.tsx"), 'export const A = () => <p className="bg-emerald-500">a</p>;\n');
  writeFileSync(join(tmp.dir, "ok.ts"), "export const answer: number = [1, 2].map((n) => n * 21)[1] ?? 0;\n");
  const bin = join(tmp.dir, "probe");
  await compileBinary([entry], bin);
  const run = Bun.spawnSync([bin, tmp.dir, REPO]);
  expect(run.stderr.toString()).toBe("");
  expect(JSON.parse(run.stdout.toString())).toEqual({ css: true, diagnostics: 0 });
}, 120_000);

test("a compiled binary starts a worker given as an extra entrypoint", async () => {
  const main = join(tmp.dir, "main-worker.ts");
  const worker = join(tmp.dir, "echo-worker.ts");
  writeFileSync(worker, 'self.onmessage = (e) => postMessage("pong:" + e.data);\n');
  writeFileSync(
    main,
    'const w = new Worker("./echo-worker.ts");\nw.onmessage = (e) => { console.log(e.data); process.exit(0); };\nw.postMessage("x");\n',
  );
  const bin = join(tmp.dir, "with-worker");
  await compileBinary([main, worker], bin);
  expect(Bun.spawnSync([bin]).stdout.toString().trim()).toBe("pong:x");
}, 120_000);

test("a child process reads a payload from file descriptor 3", async () => {
  const child = join(tmp.dir, "fd3-child.ts");
  writeFileSync(
    child,
    'const text = await Bun.file(3).text();\nconsole.log(String(text.length) + " " + String(Bun.hash(text)));\n',
  );
  const payload = "x".repeat(200_000);
  const proc = Bun.spawn([process.execPath, child], { stdio: ["ignore", "pipe", "pipe", "pipe"] });
  const fd3 = proc.stdio[3];
  if (typeof fd3 !== "number") throw new Error("file descriptor 3 is not a pipe");
  const sink = Bun.file(fd3).writer();
  sink.write(payload);
  await sink.end();
  closeSync(fd3);
  expect((await new Response(proc.stdout).text()).trim()).toBe(`200000 ${Bun.hash(payload).toString()}`);
}, 60_000);
