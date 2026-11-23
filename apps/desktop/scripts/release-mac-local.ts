import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { $ } from "bun";
import { checksumsFile, MAC_TARGET, macAssets, withDarwinPlatform } from "./release-mac";

const desktop = resolve(import.meta.dir, "..");
const root = resolve(desktop, "../..");
const BUNDLE = join(desktop, "src-tauri/target", MAC_TARGET, "release/bundle");
const KEY_DIR = join(homedir(), ".tauri");
const ALPHA = "alpha";

const args = process.argv.slice(2);
const skipBuild = args.includes("--skip-build");
const version = (await $`bun ${join(desktop, "scripts/version.ts")} get`.text()).trim();
const tag = args.find((a) => a.startsWith("v")) ?? `v${version}`;
const repo = (await $`gh repo view --json nameWithOwner -q .nameWithOwner`.text()).trim();

function step(label: string): void {
  console.log(`\n▸ ${label}`);
}

async function assertReady(): Promise<void> {
  if (process.platform !== "darwin" || process.arch !== "arm64")
    throw new Error("run this on an Apple Silicon Mac");
  await $`bun ${join(desktop, "scripts/version.ts")} check ${tag}`.quiet();
  const head = (await $`git -C ${root} rev-parse HEAD`.text()).trim();
  const tagged = (await $`git -C ${root} rev-parse ${`${tag}^{commit}`}`.text()).trim();
  if (head !== tagged) throw new Error(`HEAD is not ${tag}: check out the tag first`);
  if ((await $`git -C ${root} status --porcelain --untracked-files=no`.text()).trim() !== "")
    throw new Error("the working tree has local changes");
  const draft = (await $`gh release view ${tag} --json isDraft -q .isDraft`.nothrow().text()).trim();
  if (draft !== "true") throw new Error(`${tag} has no draft release: push the tag and let the CI create it`);
}

function signingEnv(): Record<string, string> {
  const key =
    process.env.TAURI_SIGNING_PRIVATE_KEY ?? readFileSync(join(KEY_DIR, "kibo-updater.key"), "utf8");
  const password =
    process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ??
    readFileSync(join(KEY_DIR, "kibo-updater.password"), "utf8").trim();
  return { TAURI_SIGNING_PRIVATE_KEY: key, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: password, NO_STRIP: "true" };
}

async function build(): Promise<void> {
  step("build");
  await $`bun install --frozen-lockfile`.cwd(root);
  await $`bun run --cwd packages/ui build`.cwd(root);
  await $`bun scripts/build-sidecar.ts`.cwd(desktop);
  await $`bun run tauri build --target ${MAC_TARGET}`.cwd(desktop).env({ ...process.env, ...signingEnv() });
}

async function uploadAssets(work: string): Promise<string> {
  step("upload the mac assets");
  const files = macAssets(version, BUNDLE).map((asset) => {
    const to = join(work, asset.name);
    copyFileSync(asset.from, to);
    return to;
  });
  await $`gh release upload ${tag} ${files} --clobber`;
  const signature = files.find((f) => f.endsWith(".sig"));
  if (signature === undefined) throw new Error("the updater signature is missing");
  return readFileSync(signature, "utf8").trim();
}

async function mergeLatest(work: string, signature: string): Promise<void> {
  step("latest.json");
  const dir = join(work, "latest");
  await $`gh release download ${tag} -D ${dir} -p latest.json --clobber`;
  const merged = withDarwinPlatform(JSON.parse(readFileSync(join(dir, "latest.json"), "utf8")), {
    repo,
    tag,
    signature,
  });
  writeFileSync(join(dir, "latest.json"), `${JSON.stringify(merged, null, 2)}\n`);
  await $`gh release upload ${tag} ${join(dir, "latest.json")} --clobber`;
}

async function uploadChecksums(work: string): Promise<void> {
  step("SHA256SUMS");
  const icon = join(work, "icon-512.png");
  copyFileSync(join(desktop, "src-tauri/icons/icon.png"), icon);
  await $`gh release upload ${tag} ${icon} --clobber`;
  const dist = join(work, "dist");
  await $`gh release download ${tag} -D ${dist} -p ${"*"} --clobber`;
  const sums = checksumsFile(
    readdirSync(dist).map((name) => ({ name, bytes: new Uint8Array(readFileSync(join(dist, name))) })),
  );
  writeFileSync(join(work, "SHA256SUMS"), sums);
  await $`gh release upload ${tag} ${join(work, "SHA256SUMS")} ${join(root, "scripts/install/install.sh")} --clobber`;
}

async function publish(work: string): Promise<void> {
  step("publish");
  if (!tag.includes("-alpha.")) {
    await $`gh release edit ${tag} --draft=false --latest`;
    return;
  }
  await $`gh release edit ${tag} --draft=false --prerelease --latest=false`;
  const channel = join(work, ALPHA);
  await $`gh release download ${tag} -D ${channel} -p latest.json -p SHA256SUMS -p install.sh -p icon-512.png`;
  const files = ["latest.json", "SHA256SUMS", "install.sh", "icon-512.png"].map((f) => join(channel, f));
  await $`gh release upload ${ALPHA} ${files} --clobber`;
}

await assertReady();
if (!skipBuild) await build();
const work = mkdtempSync(join(tmpdir(), "kibo-release-mac-"));
try {
  const signature = await uploadAssets(work);
  await mergeLatest(work, signature);
  await uploadChecksums(work);
  await publish(work);
  console.log(`\n${tag} published: https://github.com/${repo}/releases/tag/${tag}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
