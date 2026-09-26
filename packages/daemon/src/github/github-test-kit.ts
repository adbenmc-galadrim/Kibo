import { createMemorySecretStore } from "../integrations/memory-secret-store";
import { createIntegrationFetch, parseTestOrigins } from "../integrations/net";
import { createRateLimitGate } from "../integrations/rate-limit";
import { createRedactor } from "../integrations/redact";
import { createSettings } from "../integrations/settings";
import type { FakeHost } from "../integrations/testing/fake-host";
import type { GhRunner, IntegrationFetch, SecretStore } from "../integrations/types";
import type { FakeGithub } from "../testing/fake-github";
import { createGithubApi } from "./api";
import { createGithubAccount } from "./auth";

export function githubFetch(gh: FakeGithub): IntegrationFetch {
  return createIntegrationFetch({ aliases: parseTestOrigins([`api.github.com=${gh.url}`]) });
}

export function githubStack(
  gh: FakeGithub,
  host: FakeHost,
  secrets: SecretStore = createMemorySecretStore(createRedactor()),
  fetch: IntegrationFetch = githubFetch(gh),
  ghRunner: GhRunner = host.gh,
) {
  const redactor = createRedactor();
  const account = createGithubAccount({
    settings: createSettings(host.db),
    secrets,
    redactor,
    gh: ghRunner,
    fetch,
    now: host.now,
  });
  const gate = createRateLimitGate(host.now);
  const api = createGithubApi({
    fetch,
    token: () => account.token(),
    gate,
    onUnauthorized: () => account.forgetGhToken(),
  });
  return { account, api, secrets, redactor, gate };
}
