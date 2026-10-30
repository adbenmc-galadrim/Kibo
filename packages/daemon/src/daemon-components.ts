import { type SandboxServerOptions, startSandboxServer } from "./components/sandbox-server";
import { type ComponentsDeps, type ComponentsService, createComponentsService } from "./components/service";
import type { DaemonOptions } from "./daemon-options";
import type { Closer } from "./daemon-shutdown";
import { NO_INTEGRATION_FLAGS, type StartedIntegrations, startIntegrations } from "./integrations/bootstrap";
import { createIntegrationHost, type HostParts } from "./integrations/host";
import type { Redactor } from "./integrations/redact";
import type { Service } from "./service";

export type DaemonComponentsInput = Pick<
  ComponentsDeps,
  "db" | "notes" | "sandboxOrigin" | "runs" | "integrations" | "projectEvents"
>;

export function startDaemonComponents(
  opts: DaemonOptions,
  service: Service,
  input: DaemonComponentsInput,
  closers: Closer[],
): ComponentsService {
  const components = createComponentsService({
    ...input,
    home: opts.home,
    docs: service.docs,
    ...(opts.net && { net: opts.net }),
    ...(opts.installCli && { installCli: opts.installCli }),
    ...(opts.cliStatus && { cliStatus: opts.cliStatus }),
  });
  closers.push(service.attachComponents(components), () => components.stop());
  return components;
}

export function startDaemonIntegrations(
  opts: DaemonOptions,
  parts: Omit<HostParts, "user" | "home" | "notify">,
  origins: { devOrigins: string[]; redactor: Redactor },
  closers: Closer[],
): StartedIntegrations {
  const host = createIntegrationHost({
    ...parts,
    user: opts.user,
    home: opts.home,
    notify: opts.notify ?? (() => {}),
  });
  const flags = { ...(opts.integrations ?? NO_INTEGRATION_FLAGS), devOrigins: origins.devOrigins };
  const integrations = startIntegrations(host, flags, origins.redactor);
  closers.push(parts.service.attachIntegrations(integrations));
  closers.push(() => integrations.stop());
  return integrations;
}

export function startDaemonSandbox(
  opts: SandboxServerOptions,
  front: Closer[],
): { url: string; port: number } {
  const sandbox = startSandboxServer(opts);
  front.push(() => sandbox.stop());
  return sandbox;
}
