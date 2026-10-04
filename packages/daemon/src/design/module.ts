import { KiboError } from "@kibo/schema";
import type { IntegrationKit, IntegrationModule } from "../integrations/bootstrap";
import type { McpHub } from "../mcp/hub";
import { createFigmaAccount, type FigmaAccount } from "./figma-account";
import { createFrameCache } from "./frame-cache";
import { createFrameService, type FrameService, SHELL_INSTANCE } from "./frame-service";
import { createDesignGate, type DesignGate } from "./gate";
import { linkDesignFrame } from "./link";
import { createPenpotAccount } from "./penpot-account";
import { createFigmaMcp, type FigmaMcp } from "./providers/figma-mcp";
import { createFigmaRest, type FigmaRest } from "./providers/figma-rest";
import { createPenpot } from "./providers/penpot";
import type { DesignProviderClient } from "./providers/types";

export type DesignModule = IntegrationModule & { gate: DesignGate; open: FrameService["open"] };

const detailOf = (e: unknown) => (e instanceof KiboError ? e.detail : String(e));

function figmaProvider(account: FigmaAccount, rest: FigmaRest, mcp: FigmaMcp): DesignProviderClient {
  const active = () => (account.mode() === "mcp" ? mcp : rest);
  return {
    id: "figma",
    connected: async () => account.mode() !== null && (await active().connected()),
    version: (key) => active().version(key),
    metadata: (key) => active().metadata(key),
    render: (key) => active().render(key),
  };
}

export function designModule(kit: IntegrationKit, hub: McpHub): DesignModule {
  const { host, events } = kit;
  const rest = createFigmaRest({
    fetch: kit.net.fetch,
    token: () => figmaAccount.token(),
    redactor: kit.redactor,
    now: host.now,
  });
  const mcp = createFigmaMcp({ hub, configured: () => figmaAccount.mode() === "mcp" });
  const figmaAccount = createFigmaAccount({
    settings: kit.settings,
    secrets: kit.secrets,
    redactor: kit.redactor,
    hub,
    rest,
    mcp,
    events,
  });
  const penpot = createPenpot({
    fetch: kit.net.fetch,
    instance: () => penpotAccount.instance(),
    token: () => penpotAccount.token(),
    redactor: kit.redactor,
    now: host.now,
  });
  const penpotAccount = createPenpotAccount({
    settings: kit.settings,
    secrets: kit.secrets,
    redactor: kit.redactor,
    penpot,
    events,
  });
  const cache = createFrameCache({ db: host.db, home: host.home, now: host.now });
  cache.purge();
  const providers = { figma: figmaProvider(figmaAccount, rest, mcp), penpot };
  const service = createFrameService({
    cache,
    providers,
    penpotInstance: () => penpotAccount.instance(),
    sandboxOrigin: () => host.sandboxOrigin(),
    now: host.now,
    events,
  });
  figmaAccount.start().catch((e) => events.log("figma", "error", `start failed: ${detailOf(e)}`));
  const changed = <T>(value: T): T => {
    host.broadcast({ type: "integrations" });
    return value;
  };
  return {
    gate: createDesignGate(service),
    open: (token) => service.open(token),
    handlers: {
      connectFigma: async (req) => changed(await figmaAccount.connect(req.auth)),
      connectPenpot: async (req) => changed(await penpotAccount.connect(req.url, req.token)),
      linkDesignFrame: (req) =>
        linkDesignFrame(
          { host, service, providers, penpotInstance: () => penpotAccount.instance() },
          req.projectId,
          req.ticketId,
          req.url,
        ),
      getDesignFrame: (req) => service.frame(SHELL_INSTANCE, req.url, req.refresh),
    },
    probes: [
      {
        id: "figma",
        status: () => figmaAccount.status(),
        test: () => figmaAccount.test(),
        disconnect: async () => changed(await figmaAccount.disconnect()),
      },
      {
        id: "penpot",
        status: () => penpotAccount.status(),
        test: () => penpotAccount.test(),
        disconnect: async () => changed(await penpotAccount.disconnect()),
      },
    ],
  };
}
