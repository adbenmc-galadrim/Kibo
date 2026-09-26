import { type GithubConnectOptions, KiboError } from "@kibo/schema";
import { z } from "zod";
import { GITHUB_API, GITHUB_RULES } from "../integrations/net";
import type { Redactor } from "../integrations/redact";
import type { Settings } from "../integrations/settings";
import type { GhRunner, GithubCredentials, IntegrationFetch, SecretStore } from "../integrations/types";
import { parseGithub } from "./api";

export type GithubAuth = { mode: "gh" } | { mode: "token"; token: string };
export type GithubAccount = GithubCredentials & {
  options(): Promise<GithubConnectOptions>;
  connect(auth: GithubAuth): Promise<{ login: string }>;
  disconnect(): Promise<void>;
  verify(): Promise<string>;
  forgetGhToken(): void;
};

const GH_TTL_MS = 10 * 60_000;
const User = z.object({ login: z.string().min(1) });
const REMOTE_FAILURES: ReadonlySet<string> = new Set([
  "REMOTE_REJECTED",
  "REMOTE_UNAVAILABLE",
  "REMOTE_NOT_FOUND",
  "REMOTE_CONFLICT",
  "RATE_LIMITED",
  "TIMEOUT",
]);

const isRemoteFailure = (e: unknown) => e instanceof KiboError && REMOTE_FAILURES.has(e.code);

async function runGhToken(gh: GhRunner): Promise<{ code: number; stdout: string } | null> {
  try {
    return await gh(["auth", "token"]);
  } catch (e) {
    if (e instanceof KiboError && e.code === "GH_UNAVAILABLE") return null;
    throw e;
  }
}

export function createGithubAccount(deps: {
  settings: Settings;
  secrets: SecretStore;
  redactor: Redactor;
  gh: GhRunner;
  fetch: IntegrationFetch;
  now(): number;
}): GithubAccount {
  let ghCache: { token: string; at: number } | null = null;
  let ghLoading: Promise<string | null> | null = null;
  let generation = 0;
  const forgetGhToken = () => {
    ghCache = null;
    ghLoading = null;
  };
  const renew = () => {
    generation++;
    forgetGhToken();
  };
  const loadGhToken = async (): Promise<string | null> => {
    const started = generation;
    const r = await runGhToken(deps.gh);
    const token = r !== null && r.code === 0 ? r.stdout.trim() : "";
    if (token) deps.redactor.add(token);
    if (started === generation) ghCache = token ? { token, at: deps.now() } : null;
    return token || null;
  };
  const ghToken = (): Promise<string | null> => {
    if (ghCache && deps.now() - ghCache.at < GH_TTL_MS) return Promise.resolve(ghCache.token);
    if (ghLoading) return ghLoading;
    const loading = loadGhToken().finally(() => {
      if (ghLoading === loading) ghLoading = null;
    });
    ghLoading = loading;
    return loading;
  };
  const loginOf = async (token: string): Promise<string> => {
    const res = await deps.fetch(`https://${GITHUB_API}/user`, { bearer: token }, GITHUB_RULES);
    return parseGithub(res, User).login;
  };
  const mode = (): "gh" | "token" | null => {
    const m = deps.settings.get("github.mode");
    return m === "gh" || m === "token" ? m : null;
  };
  const remember = (m: "gh" | "token", login: string) => {
    deps.settings.set("github.mode", m);
    deps.settings.set("github.login", login);
    return { login };
  };
  const account: GithubAccount = {
    mode,
    login: () => (mode() === null ? null : deps.settings.get("github.login")),
    async token() {
      const m = mode();
      if (m === "gh") return ghToken();
      if (m === "token") return deps.secrets.get("github");
      return null;
    },
    async options() {
      const token = await ghToken();
      const ghLogin =
        token === null
          ? null
          : await loginOf(token).catch((e: unknown) => {
              if (!isRemoteFailure(e)) throw e;
              forgetGhToken();
              return null;
            });
      return { ghAvailable: ghLogin !== null, ghLogin, mode: mode() };
    },
    async connect(auth) {
      renew();
      if (auth.mode === "gh") {
        const token = await ghToken();
        if (!token) throw new KiboError("NOT_CONNECTED", "gh is not logged in");
        const login = await loginOf(token);
        if (mode() === "token") await deps.secrets.delete("github");
        return remember("gh", login);
      }
      deps.redactor.add(auth.token);
      const login = await loginOf(auth.token);
      await deps.secrets.set("github", auth.token);
      return remember("token", login);
    },
    async disconnect() {
      renew();
      if (mode() === "token") await deps.secrets.delete("github");
      deps.settings.delete("github.mode");
      deps.settings.delete("github.login");
    },
    async verify() {
      const started = generation;
      const token = await account.token();
      if (!token) throw new KiboError("NOT_CONNECTED", "github account not connected");
      const login = await loginOf(token);
      if (started === generation) deps.settings.set("github.login", login);
      return login;
    },
    forgetGhToken,
  };
  return account;
}
