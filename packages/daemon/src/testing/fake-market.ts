import { grantedOf, type Kpkg, type MarketIndex } from "@kibo/schema";
import { decodeKpkg, generateKeyPair, type KeyPair, signIndex, utf8 } from "@kibo/trust";

export type FakeMarket = {
  url: string;
  publicKey: string;
  publish(pkg: Uint8Array): Promise<void>;
  revoke(hash: string, reason: string): Promise<void>;
  setSerial(serial: number): Promise<void>;
  resignWith(keys: KeyPair): Promise<void>;
  tamper(path: string, bytes: Uint8Array): void;
  serial(): number;
  stop(): void;
};

type Published = { pkg: Kpkg; bytes: Uint8Array };
type Identity = { id: string; name: string; verified: boolean };

const packageUrl = (pkg: Kpkg) => `packages/${pkg.manifest.id}/${pkg.manifest.version}.kpkg`;

function indexPublishers(packages: Published[], verified: boolean): MarketIndex["publishers"] {
  const names = new Map(packages.map((p) => [p.pkg.publisher.publicKey, p.pkg.publisher.name]));
  return [...names.entries()].map(([publicKey, name]) => ({ publicKey, name, verified }));
}

function indexPackages(packages: Published[]): MarketIndex["packages"] {
  const ids = [...new Set(packages.map((p) => p.pkg.manifest.id))];
  return ids.map((id) => {
    const versions = packages.filter((p) => p.pkg.manifest.id === id);
    const latest = versions[versions.length - 1];
    if (!latest) throw new Error(`no version for ${id}`);
    return {
      id,
      title: latest.pkg.manifest.title,
      description: latest.pkg.manifest.description ?? "",
      kind: latest.pkg.manifest.kind,
      versions: versions.map(({ pkg, bytes }) => ({
        version: pkg.manifest.version,
        hash: pkg.hash,
        publisherKey: pkg.publisher.publicKey,
        size: bytes.byteLength,
        permissions: grantedOf(pkg.manifest),
        publishedAt: pkg.publishedAt,
        url: packageUrl(pkg),
      })),
    };
  });
}

export async function startFakeMarket(
  opts: { id?: string; name?: string; verified?: boolean } = {},
): Promise<FakeMarket> {
  const identity: Identity = {
    id: opts.id ?? "equipe",
    name: opts.name ?? "Équipe",
    verified: opts.verified ?? true,
  };
  let keys = await generateKeyPair();
  let serial = 1;
  const packages: Published[] = [];
  const revoked: { hash: string; reason: string }[] = [];
  const files = new Map<string, Uint8Array>();
  const tampered = new Map<string, Uint8Array>();

  const rebuild = async (): Promise<void> => {
    const index: MarketIndex = {
      format: 1,
      source: { id: identity.id, name: identity.name, publicKey: keys.publicKey },
      serial,
      generatedAt: new Date(0).toISOString(),
      publishers: indexPublishers(packages, identity.verified),
      packages: indexPackages(packages),
      revoked: [...revoked],
    };
    const signed = await signIndex(index, keys.privateKey);
    files.set("index.json", signed.bytes);
    files.set("index.json.sig", utf8(signed.sig));
    for (const { pkg, bytes } of packages) files.set(packageUrl(pkg), bytes);
  };

  await rebuild();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(req) {
      const path = decodeURIComponent(new URL(req.url).pathname.slice(1));
      const body = tampered.get(path) ?? files.get(path);
      return body ? new Response(body) : new Response("not found", { status: 404 });
    },
  });

  return {
    url: `http://127.0.0.1:${server.port}/`,
    get publicKey() {
      return keys.publicKey;
    },
    async publish(bytes) {
      packages.push({ pkg: decodeKpkg(bytes), bytes });
      serial += 1;
      await rebuild();
    },
    async revoke(hash, reason) {
      revoked.push({ hash, reason });
      serial += 1;
      await rebuild();
    },
    async setSerial(next) {
      serial = next;
      await rebuild();
    },
    async resignWith(next) {
      keys = next;
      serial += 1;
      await rebuild();
    },
    tamper(path, bytes) {
      tampered.set(path, bytes);
    },
    serial: () => serial,
    stop: () => server.stop(true),
  };
}
