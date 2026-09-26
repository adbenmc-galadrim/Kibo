import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { KiboError } from "@kibo/schema";
import { formatFingerprint } from "@kibo/trust";
import { createInvite, disableUser, revokeDevice } from "./accounts";
import { readAudit } from "./audit";
import { openServerDb, type ServerDb } from "./db";
import { initMarketSource, TeamMarket } from "./market/team-market";
import { startSyncServer } from "./server";

export type CliIo = { out(line: string): void; err(line: string): void; now(): number };

const USAGE = [
  "Utilisation :",
  "  kibo-sync serve --data <dossier> --host <adresse> --port <port> --origin <wss://…> [--tls-cert <fichier> --tls-key <fichier> | --behind-proxy]",
  "  kibo-sync invite account --name <nom> --data <dossier>",
  "  kibo-sync device revoke <deviceId> --data <dossier>",
  "  kibo-sync user disable <userId> --data <dossier>",
  "  kibo-sync audit [--limit <n>] --data <dossier>",
  "  kibo-sync market init --id <id> --name <nom> --data <dossier>",
  "  kibo-sync market grant <userId> owner|publisher --data <dossier>",
];

const options = {
  data: { type: "string" },
  name: { type: "string" },
  id: { type: "string" },
  host: { type: "string", default: "127.0.0.1" },
  port: { type: "string", default: "8443" },
  origin: { type: "string", default: "" },
  "tls-cert": { type: "string" },
  "tls-key": { type: "string" },
  "behind-proxy": { type: "boolean", default: false },
  limit: { type: "string", default: "50" },
} as const;

const parse = (argv: string[]) => parseArgs({ args: argv, options, allowPositionals: true });
type Values = ReturnType<typeof parse>["values"];
type Command = (values: Values, positionals: string[], io: CliIo) => Promise<number>;

function required(value: string | undefined, flag: string): string {
  if (!value) throw new KiboError("INVALID_INPUT", `missing --${flag}`);
  return value;
}

function positiveInt(value: string, flag: string, max: number): number {
  const n = Number(value);
  if (!/^\d+$/.test(value) || n < 1 || n > max)
    throw new KiboError("INVALID_INPUT", `--${flag} must be 1 to ${max}`);
  return n;
}

async function withDb<T>(dataDir: string, fn: (sdb: ServerDb) => Promise<T> | T): Promise<T> {
  const sdb = openServerDb(join(dataDir, "sync.db"));
  try {
    return await fn(sdb);
  } finally {
    sdb.close();
  }
}

const serve: Command = async (values, _positionals, io) => {
  const cert = values["tls-cert"];
  const key = values["tls-key"];
  if (Boolean(cert) !== Boolean(key))
    throw new KiboError("INVALID_INPUT", "--tls-cert and --tls-key go together");
  const server = await startSyncServer({
    dataDir: required(values.data, "data"),
    hostname: values.host,
    port: positiveInt(values.port, "port", 65_535),
    origin: values.origin,
    tls: cert && key ? { cert: readFileSync(cert, "utf8"), key: readFileSync(key, "utf8") } : null,
    behindProxy: values["behind-proxy"],
  });
  io.out(`kibo-sync écoute sur ${server.url}`);
  await new Promise<void>((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
  await server.stop();
  return 0;
};

const inviteAccount: Command = async (values, _positionals, io) => {
  const name = required(values.name, "name");
  const invite = await withDb(required(values.data, "data"), (sdb) =>
    createInvite(sdb, { kind: "account", name, createdBy: "admin" }, io.now()),
  );
  io.out("Code d'invitation (affiché une seule fois, valable 48 h) :");
  io.out(invite.code);
  return 0;
};

const revokeDeviceCommand: Command = async (values, positionals, io) => {
  const deviceId = required(positionals[2], "deviceId");
  await withDb(required(values.data, "data"), (sdb) =>
    revokeDevice(sdb, { deviceId, by: "admin" }, io.now()),
  );
  io.out(`Appareil ${deviceId} révoqué. Ses connexions sont coupées sous 5 secondes.`);
  return 0;
};

const disableUserCommand: Command = async (values, positionals, io) => {
  const userId = required(positionals[2], "userId");
  await withDb(required(values.data, "data"), (sdb) => disableUser(sdb, userId, io.now()));
  io.out(`Utilisateur ${userId} désactivé.`);
  return 0;
};

const auditCommand: Command = async (values, _positionals, io) => {
  const limit = positiveInt(values.limit, "limit", 10_000);
  const entries = await withDb(required(values.data, "data"), (sdb) => readAudit(sdb, limit));
  for (const e of entries) {
    const at = new Date(e.at).toISOString();
    io.out([at, e.kind, e.userId ?? "-", e.deviceId ?? "-", e.projectId ?? "-", e.detail ?? ""].join("  "));
  }
  return 0;
};

const marketInit: Command = async (values, _positionals, io) => {
  const name = required(values.name, "name");
  const res = await initMarketSource(required(values.data, "data"), { id: required(values.id, "id"), name });
  io.out(`Source « ${name} » créée.`);
  io.out(`Empreinte de la clé : ${formatFingerprint(res.fingerprint)}`);
  io.out(`Clé publique : ${res.publicKey}`);
  return 0;
};

const marketGrant: Command = async (values, positionals, io) => {
  const userId = required(positionals[2], "userId");
  const role = positionals[3];
  if (role !== "owner" && role !== "publisher")
    throw new KiboError("INVALID_INPUT", "role must be owner or publisher");
  const dataDir = required(values.data, "data");
  await withDb(dataDir, async (sdb) => {
    const market = await TeamMarket.open(sdb, dataDir);
    if (!market) throw new KiboError("INVALID_INPUT", "run `kibo-sync market init` first");
    market.grant(userId, role);
  });
  io.out(`Rôle ${role} accordé à ${userId}.`);
  return 0;
};

const COMMANDS: Record<string, Command> = {
  serve,
  "invite account": inviteAccount,
  "device revoke": revokeDeviceCommand,
  "user disable": disableUserCommand,
  audit: auditCommand,
  "market init": marketInit,
  "market grant": marketGrant,
};

function commandOf(positionals: string[]): Command | undefined {
  const [command = "", sub = ""] = positionals;
  return COMMANDS[`${command} ${sub}`] ?? COMMANDS[command];
}

function usage(io: CliIo): number {
  for (const line of USAGE) io.err(line);
  return 1;
}

export async function runCli(argv: string[], io: CliIo): Promise<number> {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(argv);
  } catch (e) {
    io.err(`kibo-sync : ${String(e)}`);
    return usage(io);
  }
  const command = commandOf(parsed.positionals);
  if (!command) return usage(io);
  try {
    return await command(parsed.values, parsed.positionals, io);
  } catch (e) {
    if (!(e instanceof KiboError)) throw e;
    io.err(`kibo-sync : ${e.code} ${e.detail}`);
    if (e.detail.startsWith("missing --")) usage(io);
    return 1;
  }
}

if (import.meta.main) {
  process.exit(
    await runCli(process.argv.slice(2), {
      out: (l) => console.log(l),
      err: (l) => console.error(l),
      now: Date.now,
    }),
  );
}
