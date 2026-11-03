import { encodePairingCode, generateRootKey } from "@kibo/remote";
import { KiboError, type RemoteStatus } from "@kibo/schema";
import type { RemoteLink } from "./link";
import type { Pusher } from "./pusher";
import { registerMac } from "./register";
import type { Revoker } from "./revoker";
import type { RemoteController } from "./rpc";
import { newMacToken, type RemoteSecrets } from "./secrets";
import type { RemoteSettingsStore } from "./settings";

const OPEN_WAIT_MS = 5_000;
const PAIR_WAIT_MS = 10_000;

type ControllerDeps = {
  settings: RemoteSettingsStore;
  secrets: RemoteSecrets;
  link: RemoteLink;
  pusher: Pusher;
  revoker: Revoker;
  defaultUrl: string;
  fetch: Parameters<typeof registerMac>[0];
  log(line: string): void;
  ready: Promise<void>;
  exclusive<R>(work: () => Promise<R>): Promise<R>;
};

export function createRemoteController(deps: ControllerDeps): RemoteController {
  const { settings, secrets, link, pusher } = deps;

  const status = (): RemoteStatus => {
    const s = settings.read();
    return {
      enabled: s.enabled,
      serverUrl: s.serverUrl ?? deps.defaultUrl,
      connected: link.connected(),
      lastPushAt: pusher.lastPushAt(),
      projects: s.projects,
      phonePaired: s.phonePaired,
      revokePending: s.pendingRevoke,
      revokeAbandoned: s.revokeAbandoned,
      keyEpoch: s.keyEpoch,
    };
  };

  const assertOnline = () => {
    if (!settings.read().enabled) throw new KiboError("REMOTE_DISABLED", "L'accès téléphone est désactivé");
    if (!link.connected())
      throw new KiboError("REMOTE_UNAVAILABLE", "Serveur injoignable · réessaie dans un instant");
  };

  const revoke = async () => {
    link.send({ type: "phone.revoke" });
    const rootKey = generateRootKey();
    const keyEpoch = settings.read().keyEpoch + 1;
    await secrets.saveRootKey(rootKey);
    settings.write({ keyEpoch, phonePaired: false });
    await link.rotate(rootKey, keyEpoch);
    await pusher.pushAll();
  };

  const revokeLater = async () => {
    const { serverUrl, accountId } = settings.read();
    const macToken = await secrets.macToken();
    settings.clear();
    if (serverUrl === null || macToken === null) {
      deps.log("[kibo-daemon] remote disabled offline without a mac token, the phone cannot be revoked");
      settings.write({ revokeAbandoned: true });
      return secrets.clear();
    }
    await secrets.forgetRootKey();
    settings.write({ serverUrl, accountId, pendingRevoke: true });
    deps.log("[kibo-daemon] remote disabled offline, the phone revocation waits for the server");
    deps.revoker.start({ serverUrl, macToken });
  };

  const withReady =
    <A extends unknown[], R>(work: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      await deps.ready;
      return deps.exclusive(() => work(...args));
    };

  return {
    status: withReady(async () => status()),
    enable: withReady(async ({ serverUrl, setupCode }) => {
      const macToken = newMacToken();
      const { accountId } = await registerMac(deps.fetch, { serverUrl, setupCode, macToken });
      deps.revoker.stop();
      link.stop();
      pusher.stop();
      const rootKey = generateRootKey();
      const keyEpoch = settings.read().keyEpoch + 1;
      await secrets.save({ rootKey, macToken });
      settings.write({
        enabled: true,
        serverUrl,
        accountId,
        keyEpoch,
        phonePaired: false,
        pendingRevoke: false,
        revokeAbandoned: false,
      });
      await link.start({ serverUrl, macToken, accountId, rootKey, epoch: keyEpoch });
      await link.opened(OPEN_WAIT_MS);
      return status();
    }),
    disable: withReady(async () => {
      const revoked = link.send({ type: "phone.revoke" });
      link.stop();
      pusher.stop();
      if (revoked) {
        await secrets.clear();
        settings.clear();
      } else await revokeLater();
      return status();
    }),
    setProjects: withReady(async (projectIds) => {
      const before = settings.read().projects;
      const after = settings.setProjects(projectIds);
      if (!settings.read().enabled) return status();
      for (const projectId of before.filter((id) => !after.includes(id)))
        await pusher.removeProject(projectId);
      for (const projectId of after.filter((id) => !before.includes(id))) await pusher.pushProject(projectId);
      return status();
    }),
    createPairing: withReady(async () => {
      assertOnline();
      if (settings.read().phonePaired) await revoke();
      await pusher.idle();
      const { pairToken, expiresAt } = await link.pairToken(PAIR_WAIT_MS);
      const { accountId } = settings.read();
      const rootKey = link.rootKey();
      if (accountId === null || rootKey === null)
        throw new KiboError("REMOTE_DISABLED", "L'accès téléphone est désactivé");
      const code = encodePairingCode({ accountId, pairToken, rootKey });
      settings.write({ phonePaired: true });
      return { code, expiresAt };
    }),
    revokePhone: withReady(async () => {
      assertOnline();
      await revoke();
      return status();
    }),
  };
}
