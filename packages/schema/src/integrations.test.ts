import { describe, expect, test } from "bun:test";
import {
  Binding,
  ComponentManifest,
  FigmaNodeRef,
  GITHUB_SECRET_HOSTS,
  GithubIssueRef,
  githubError,
  githubIssueState,
  IntegrationEvent,
  MappedRemote,
  McpItemRef,
  McpServerInput,
  mcpCovered,
  PushOp,
  projectStatus,
  RepoSlug,
  RpcRequest,
  remoteStatusId,
  SecretNameSchema,
  secretHostsCovered,
  WebUrl,
} from "./index";

describe("integration contracts", () => {
  test("repo slugs follow owner/name", () => {
    expect(RepoSlug.safeParse("adam/kibo").success).toBe(true);
    expect(RepoSlug.safeParse("adam/kibo.js").success).toBe(true);
    expect(RepoSlug.safeParse("adam").success).toBe(false);
    expect(RepoSlug.safeParse("../etc/passwd").success).toBe(false);
  });

  test("web urls refuse other schemes", () => {
    expect(WebUrl.safeParse("https://github.com/adam/kibo/issues/1").success).toBe(true);
    expect(WebUrl.safeParse("javascript:alert(1)").success).toBe(false);
    expect(WebUrl.safeParse("data:text/html,x").success).toBe(false);
    expect(
      McpItemRef.safeParse({ kind: "mcp_item", server: "ctx", itemId: "1", url: "javascript:x", title: "T" })
        .success,
    ).toBe(false);
  });

  test("secret names are scoped", () => {
    for (const ok of ["github", "figma", "mcp:context7", "mcp:context7:API_KEY"]) {
      expect(SecretNameSchema.safeParse(ok).success).toBe(true);
    }
    for (const ko of ["aws", "github:", "mcp:Bad", "mcp:ctx:lower", ""]) {
      expect(SecretNameSchema.safeParse(ko).success).toBe(false);
    }
  });

  test("github issue refs expose pending, linked and broken", () => {
    const ref = GithubIssueRef.parse({
      kind: "github_issue",
      bindingId: "b1",
      repo: "adam/kibo",
      number: null,
      nodeId: null,
      url: null,
    });
    expect(githubIssueState(ref)).toBe("pending");
    expect(
      githubIssueState({ ...ref, number: 4, nodeId: "I_4", url: "https://github.com/adam/kibo/issues/4" }),
    ).toBe("linked");
    expect(githubIssueState({ ...ref, number: 4, nodeId: "I_4", url: null })).toBe("broken");
  });

  test("figma node refs need a file key and a node id", () => {
    const ok = {
      kind: "figma_node",
      fileKey: "AbCdEf123456",
      nodeId: "12:34",
      url: "https://www.figma.com/design/AbCdEf123456/Kibo?node-id=12-34",
      name: "Tickets",
    };
    expect(FigmaNodeRef.safeParse(ok).success).toBe(true);
    expect(FigmaNodeRef.safeParse({ ...ok, nodeId: "12-34" }).success).toBe(false);
  });

  test("a binding config defaults filters and validates the status map", () => {
    const b = Binding.parse({
      id: "b1",
      adapter: "github-issues",
      config: { repo: "adam/kibo", project: null },
      createdBy: "adam",
      runner: "adam",
    });
    expect(b.config.labels).toEqual([]);
    expect(b.config.importClosed).toBe(false);
    expect(
      Binding.safeParse({
        ...b,
        config: {
          ...b.config,
          project: { owner: "adam", number: 1, nodeId: "P", statusFieldId: "F", statusMap: { nope: "x" } },
        },
      }).success,
    ).toBe(false);
  });

  test("push ops and mapped remotes are strict", () => {
    const fields = { title: "T", description: "", statusId: "todo", closed: false };
    expect(PushOp.safeParse({ kind: "create", ticketId: "1@1", fields, since: null }).success).toBe(true);
    expect(PushOp.safeParse({ kind: "update", remoteId: "4", patch: { title: "U" } }).success).toBe(true);
    expect(PushOp.safeParse({ kind: "delete", remoteId: "4" }).success).toBe(false);
    const ref = {
      kind: "github_issue",
      bindingId: "b1",
      repo: "adam/kibo",
      number: 4,
      nodeId: "I_4",
      url: "https://github.com/adam/kibo/issues/4",
    };
    expect(
      MappedRemote.safeParse({ remoteId: "4", updatedAt: "2026-09-26T10:00:00Z", fields, ref, labels: [] })
        .success,
    ).toBe(true);
    expect(
      MappedRemote.safeParse({ remoteId: "4", updatedAt: "hier", fields, ref, labels: [] }).success,
    ).toBe(false);
  });

  test("mcp server input requires https unless loopback and refuses reserved ids", () => {
    const stdio = {
      transport: "stdio",
      id: "ctx",
      name: "Context7",
      command: "npx",
      args: ["-y", "@upstash/context7-mcp"],
    };
    const parsed = McpServerInput.parse(stdio);
    expect(parsed.transport === "stdio" ? parsed.envNames : null).toEqual([]);
    expect(McpServerInput.safeParse({ ...stdio, id: "figma" }).success).toBe(false);
    const http = { transport: "http", id: "fs", name: "FS", url: "http://127.0.0.1:9000/mcp" };
    expect(McpServerInput.safeParse(http).success).toBe(true);
    expect(McpServerInput.safeParse({ ...http, url: "http://10.0.0.2/mcp" }).success).toBe(false);
    expect(McpServerInput.safeParse({ ...http, url: "https://mcp.example.com/mcp" }).success).toBe(true);
  });

  test("status projection is consistent on both sides", () => {
    const map = { todo: "O1", in_progress: "O2", in_review: "O2", done: "O3" };
    expect(remoteStatusId(true, "O1", map)).toBe("done");
    expect(remoteStatusId(false, "O2", map)).toBe("in_progress");
    expect(remoteStatusId(false, "O3", map)).toBe("todo");
    expect(remoteStatusId(false, null, null)).toBe("todo");
    expect(projectStatus("in_review", map, "todo")).toBe("in_progress");
    expect(projectStatus("blocked", map, "in_progress")).toBe("in_progress");
    expect(projectStatus("in_progress", null, "done")).toBe("todo");
    expect(projectStatus("done", map, "todo")).toBe("done");
  });

  test("mcp rules cover a whole server or a single tool", () => {
    expect(mcpCovered(["context7"], "context7", "get-library-docs", null)).toBe(true);
    expect(mcpCovered(["context7/resolve"], "context7", "get-library-docs", null)).toBe(false);
    expect(mcpCovered(["context7/resolve"], "context7", null, null)).toBe(false);
    expect(mcpCovered(["{config.server}"], "fs", "read", { server: "fs" })).toBe(true);
    expect(mcpCovered(["{config.server}"], "fs", "read", null)).toBe(false);
  });

  test("manifest v1 accepts adapters, secrets and mcp with defaults", () => {
    const base = { id: "probe", version: "1.0.0", kind: "adapter", title: "Probe", reads: [], writes: [] };
    const m = ComponentManifest.parse({
      ...base,
      net: ["api.github.com"],
      secrets: [{ name: "github", hosts: ["api.github.com"] }],
    });
    expect(m.mcp).toEqual([]);
    expect(secretHostsCovered(m)).toEqual([]);
    const loose = ComponentManifest.parse({
      ...base,
      secrets: [{ name: "github", hosts: ["api.github.com"] }],
    });
    expect(secretHostsCovered(loose)).toEqual(["api.github.com"]);
  });

  test("the github secret is refused for any host but the github api (N45)", () => {
    const base = { id: "probe", version: "1.0.0", kind: "adapter", title: "Probe", reads: [], writes: [] };
    const ok = { ...base, secrets: [{ name: "github", hosts: [...GITHUB_SECRET_HOSTS] }] };
    expect(ComponentManifest.safeParse(ok).success).toBe(true);
    const leak = { ...base, secrets: [{ name: "github", hosts: ["api.github.com", "evil.example.com"] }] };
    const parsed = ComponentManifest.safeParse(leak);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toContain("INVALID_MANIFEST");
    const other = { ...base, secrets: [{ name: "figma", hosts: ["api.figma.com"] }] };
    expect(ComponentManifest.safeParse(other).success).toBe(true);
  });

  test("github statuses map to stable error codes", () => {
    const h = (headers: Record<string, string>) => (name: string) => headers[name] ?? null;
    expect(githubError(404, h({}), "{}").code).toBe("REMOTE_NOT_FOUND");
    expect(githubError(410, h({}), "{}").code).toBe("REMOTE_NOT_FOUND");
    expect(githubError(409, h({}), "{}").code).toBe("REMOTE_CONFLICT");
    expect(githubError(422, h({}), '{"message":"Validation Failed"}').detail).toContain("Validation Failed");
    expect(githubError(403, h({ "x-ratelimit-remaining": "0" }), "{}").code).toBe("RATE_LIMITED");
    expect(githubError(429, h({ "retry-after": "30" }), "{}").code).toBe("RATE_LIMITED");
    expect(githubError(403, h({ "x-ratelimit-remaining": "40" }), "{}").code).toBe("REMOTE_REJECTED");
    expect(githubError(401, h({}), "not json").detail).toBe("github 401: not json");
    expect(githubError(502, h({}), "").code).toBe("REMOTE_UNAVAILABLE");
  });

  test("integration rpc and events are part of the protocol", () => {
    expect(RpcRequest.safeParse({ method: "listIntegrations" }).success).toBe(true);
    expect(
      RpcRequest.safeParse({ method: "connectGithub", auth: { mode: "token", token: "ghp_x" } }).success,
    ).toBe(true);
    expect(RpcRequest.safeParse({ method: "connectGithub", auth: { mode: "oauth" } }).success).toBe(false);
    expect(
      IntegrationEvent.safeParse({
        type: "sync.conflict",
        projectId: "p",
        ticketKey: "KIB-1",
        field: "title",
      }).success,
    ).toBe(true);
    expect(
      IntegrationEvent.safeParse({
        type: "notice",
        title: "CI cassée sur KIB-7",
        body: "ci a échoué sur la PR #12.",
      }).success,
    ).toBe(true);
    expect(IntegrationEvent.safeParse({ projectId: "p" }).success).toBe(false);
  });
});
