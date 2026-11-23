export const MAC_TARGET = "aarch64-apple-darwin";
const UPDATER_ARCHIVE = "Kibo_aarch64.app.tar.gz";
const DARWIN_PLATFORMS = ["darwin-aarch64", "darwin-aarch64-app"] as const;
const NOT_SUMMED = new Set(["SHA256SUMS", "install.sh"]);

export type Asset = { from: string; name: string };
export type UpdaterPlatform = { signature: string; url: string };
export type UpdaterManifest = Record<string, unknown> & {
  version: string;
  platforms: Record<string, UpdaterPlatform>;
};
export type DarwinBuild = { repo: string; tag: string; signature: string };

export function macAssets(version: string, bundleDir: string): Asset[] {
  return [
    { from: `${bundleDir}/dmg/Kibo_${version}_aarch64.dmg`, name: `Kibo_${version}_aarch64.dmg` },
    { from: `${bundleDir}/macos/Kibo.app.tar.gz`, name: UPDATER_ARCHIVE },
    { from: `${bundleDir}/macos/Kibo.app.tar.gz.sig`, name: `${UPDATER_ARCHIVE}.sig` },
  ];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function isPlatform(value: unknown): value is UpdaterPlatform {
  return isRecord(value) && typeof value.signature === "string" && typeof value.url === "string";
}

function parseManifest(value: unknown): UpdaterManifest {
  if (!isRecord(value) || typeof value.version !== "string") throw new Error("latest.json has no version");
  const platforms = value.platforms;
  if (!isRecord(platforms)) throw new Error("latest.json has no platforms");
  const parsed: Record<string, UpdaterPlatform> = {};
  for (const [key, platform] of Object.entries(platforms)) {
    if (!isPlatform(platform)) throw new Error(`latest.json has a malformed platform: ${key}`);
    parsed[key] = platform;
  }
  return { ...value, version: value.version, platforms: parsed };
}

export function withDarwinPlatform(latest: unknown, build: DarwinBuild): UpdaterManifest {
  const manifest = parseManifest(latest);
  const version = build.tag.replace(/^v/, "");
  if (manifest.version !== version) throw new Error(`latest.json is for ${manifest.version}, not ${version}`);
  const darwin: UpdaterPlatform = {
    signature: build.signature,
    url: `https://github.com/${build.repo}/releases/download/${build.tag}/${UPDATER_ARCHIVE}`,
  };
  const platforms = { ...manifest.platforms };
  for (const key of DARWIN_PLATFORMS) platforms[key] = darwin;
  return { ...manifest, platforms };
}

const sha256 = (bytes: Uint8Array): string => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

export function checksumsFile(files: readonly { name: string; bytes: Uint8Array }[]): string {
  const summed = files
    .filter((f) => !NOT_SUMMED.has(f.name))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return summed.map((f) => `${sha256(f.bytes)}  ${f.name}\n`).join("");
}
