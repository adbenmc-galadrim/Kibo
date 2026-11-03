import type { ProjectSummary, RemotePairing, RemoteStatus, RpcRequest } from "@kibo/schema";

const DISABLED: RemoteStatus = {
  enabled: false,
  serverUrl: null,
  connected: false,
  lastPushAt: null,
  projects: [],
  phonePaired: false,
  keyEpoch: 0,
};

export const ENABLED: RemoteStatus = {
  ...DISABLED,
  enabled: true,
  serverUrl: "https://kibo.shinseo.fr",
  connected: true,
  keyEpoch: 1,
};

export const PAIRING_CODE = "kibo1.BXNpbG8tYWNjb3VudC0wMDAxLXRlc3Q";

const counts = { backlog: 0, todo: 0, in_progress: 0, in_review: 0, blocked: 0, done: 0 };
const project = (id: string, name: string, key: string, color: string): ProjectSummary => ({
  id,
  name,
  key,
  folder: null,
  color,
  worktree: null,
  storybook: null,
  delivery: null,
  tracking: null,
  description: null,
  client: null,
  counts,
});

export const PROJECTS: ProjectSummary[] = [
  project("silo", "Silo", "SILO", "#14B8A6"),
  project("kibo", "Kibo", "KIB", "#6366F1"),
  project("atlas", "Atlas", "ATL", "#84CC16"),
];

type FakeRemote = {
  status: RemoteStatus;
  calls: RpcRequest[];
  rpc(req: RpcRequest): Promise<unknown>;
};

const pairing = (): RemotePairing => ({ code: PAIRING_CODE, expiresAt: Date.now() + 600_000 });

export function createFakeRemote(): FakeRemote {
  const fake: FakeRemote = {
    status: DISABLED,
    calls: [],
    rpc: async (req) => {
      fake.calls.push(req);
      if (req.method === "listProjects") return PROJECTS;
      if (req.method === "remote.createPairing") return pairing();
      if (req.method === "remote.enable")
        fake.status = { ...ENABLED, serverUrl: req.serverUrl, lastPushAt: Date.now() - 12_000 };
      if (req.method === "remote.disable") fake.status = DISABLED;
      if (req.method === "remote.setProjects") fake.status = { ...fake.status, projects: req.projectIds };
      if (req.method === "remote.revokePhone") fake.status = { ...fake.status, phonePaired: false };
      return fake.status;
    },
  };
  return fake;
}
