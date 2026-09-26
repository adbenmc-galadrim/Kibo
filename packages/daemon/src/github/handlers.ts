import { GITHUB_GRAPHQL, type GithubProject, type IntegrationStatus, KiboError } from "@kibo/schema";
import { z } from "zod";
import type { IntegrationKit, IntegrationModule } from "../integrations/bootstrap";
import { githubRepoOf } from "../integrations/github-remote";
import { baseStatus } from "../integrations/probes";
import type { IntegrationProbe } from "../integrations/types";
import type { GithubApi } from "./api";
import type { GithubAccount } from "./auth";

const MAX_REPO_PAGES = 5;
const MAX_REPOS = 50;
const Repo = z.object({ full_name: z.string(), private: z.boolean(), description: z.string().nullable() });
const Option = z.object({ id: z.string(), name: z.string() });
const ProjectNode = z.object({
  id: z.string(),
  number: z.number().int(),
  title: z.string(),
  owner: z.object({ login: z.string() }),
  field: z
    .object({ id: z.string(), options: z.array(Option) })
    .nullable()
    .optional(),
});
const Projects = z.object({
  repository: z.object({ projectsV2: z.object({ nodes: z.array(ProjectNode.nullable()) }) }).nullable(),
});

type Github = { account: GithubAccount; api: GithubApi };

function toProject(n: z.infer<typeof ProjectNode> | null): GithubProject[] {
  if (n === null) return [];
  return [
    { owner: n.owner.login, number: n.number, nodeId: n.id, title: n.title, statusField: n.field ?? null },
  ];
}

function probes(kit: IntegrationKit, { account }: Github): IntegrationProbe[] {
  const live = (id: IntegrationStatus["id"]): IntegrationStatus => ({
    ...baseStatus(id, "connected"),
    resumeAt: kit.net.gate.blockedUntil(),
  });
  const anyRepo = async () => {
    for (const p of kit.host.projects()) if (await githubRepoOf(kit.host, p.id)) return true;
    return false;
  };
  const githubStatus = async (): Promise<IntegrationStatus> => {
    const mode = account.mode();
    if (mode === null) return baseStatus("github", "disconnected");
    if (mode === "token") {
      const keychain = await kit.secrets.availability();
      if (!keychain.ok) {
        const error: IntegrationStatus["error"] = {
          code: "SECRET_STORE_UNAVAILABLE",
          message: keychain.reason,
        };
        return { ...baseStatus("github", "error"), account: account.login(), error };
      }
    }
    return { ...live("github"), account: account.login() };
  };
  const followGithub = async (
    id: IntegrationStatus["id"],
    ready: () => Promise<boolean>,
  ): Promise<IntegrationStatus> => {
    const github = await githubStatus();
    if (github.state === "error") return { ...github, id, account: null };
    if (github.state !== "connected" || !(await ready())) return baseStatus(id, "disconnected");
    return live(id);
  };
  return [
    {
      id: "github",
      status: githubStatus,
      test: async () => ({ ...live("github"), account: await account.verify() }),
      async disconnect() {
        await account.disconnect();
        kit.events.log("github", "info", "disconnected");
        kit.host.broadcast({ type: "integrations" });
      },
    },
    {
      id: "github-issues",
      status: () => followGithub("github-issues", async () => true),
      test: async () => {
        await account.verify();
        return live("github-issues");
      },
    },
    {
      id: "github-actions",
      status: () => followGithub("github-actions", anyRepo),
    },
  ];
}

export function githubModule(kit: IntegrationKit, github: Github): IntegrationModule {
  const { account, api } = github;
  return {
    handlers: {
      getGithubConnectOptions: () => account.options(),
      async connectGithub(req) {
        const out = await account.connect(req.auth);
        kit.events.log("github", "info", `connected as ${out.login} (${req.auth.mode})`);
        kit.host.broadcast({ type: "integrations" });
        return out;
      },
      async listGithubRepos(req) {
        const repos = await api.paginate("/user/repos?per_page=100&sort=updated", Repo, MAX_REPO_PAGES);
        const q = req.query.trim().toLowerCase();
        return repos
          .filter((r) => q === "" || r.full_name.toLowerCase().includes(q))
          .slice(0, MAX_REPOS)
          .map((r) => ({ fullName: r.full_name, private: r.private, description: r.description }));
      },
      async listGithubProjects(req) {
        const [owner, name] = req.repo.split("/");
        const data = await api.graphql(GITHUB_GRAPHQL.listProjects, { owner, name }, Projects);
        if (!data.repository) throw new KiboError("REMOTE_NOT_FOUND", `repository ${req.repo} not found`);
        return data.repository.projectsV2.nodes.flatMap(toProject);
      },
    },
    probes: probes(kit, github),
  };
}
