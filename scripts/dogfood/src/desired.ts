import type { GuidelineOwner, Layout, PermissionMode, WorkspaceStrategy } from "@kibo/schema";

export type DesiredProject = { name: string; key: string; color: string };
export type DesiredInstance = { componentId: string; config: Record<string, unknown>; layout?: Layout };
export type DesiredPage = { title: string; kind: "dashboard" | "view"; instances: DesiredInstance[] };
export type DesiredDomain = { name: string; guideline: string };
export type DesiredTicket = { title: string; description: string; domain: string | null };
export type ProfileSettings = {
  permissionMode: PermissionMode;
  workspace: WorkspaceStrategy;
  maxParallel: number;
};

export type OwnerRef =
  | { scope: "workspace" }
  | { scope: "project" }
  | { scope: "domain"; name: string }
  | { scope: "profile"; name: string };
export type DesiredGuideline = { owner: OwnerRef; path: string; content: string };

export type ResolvedIds = {
  projectId: string;
  domains: ReadonlyMap<string, string>;
  profiles: ReadonlyMap<string, string>;
};

export function resolveOwner(owner: OwnerRef, ids: ResolvedIds): GuidelineOwner | null {
  switch (owner.scope) {
    case "workspace":
      return { scope: "workspace" };
    case "project":
      return { scope: "project", projectId: ids.projectId };
    case "domain": {
      const domainId = ids.domains.get(owner.name);
      return domainId ? { scope: "domain", domainId } : null;
    }
    case "profile": {
      const profileId = ids.profiles.get(owner.name);
      return profileId ? { scope: "profile", profileId } : null;
    }
  }
}
