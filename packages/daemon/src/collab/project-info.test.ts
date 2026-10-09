import { expect, test } from "bun:test";
import { createProjectDoc, writeMembers } from "@kibo/core";
import { projectSyncInfo } from "./project-info";
import type { SyncProjectRow } from "./sync-db";

const doc = () =>
  createProjectDoc({
    id: "p1",
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#14B8A6",
    worktree: null,
    storybook: null,
  });
const row: SyncProjectRow = {
  projectId: "p1",
  enabled: true,
  role: "editor",
  lastServerVersion: null,
  lastSyncAt: null,
  lastError: null,
  accessRevoked: false,
};

test("a project without a sync row is local and writable", () => {
  expect(projectSyncInfo({ row: null, doc: doc(), members: [] })).toEqual({
    shared: false,
    keyAllocator: "local",
    role: null,
    access: "write",
    members: [],
  });
});

test("the role and revocation decide the access", () => {
  expect(projectSyncInfo({ row, doc: doc(), members: [] }).access).toBe("write");
  expect(projectSyncInfo({ row: { ...row, role: "viewer" }, doc: doc(), members: [] }).access).toBe(
    "read-only",
  );
  expect(projectSyncInfo({ row: { ...row, accessRevoked: true }, doc: doc(), members: [] }).access).toBe(
    "revoked",
  );
});

test("server members are named from the doc directory, which is the offline fallback", () => {
  const d = doc();
  writeMembers(d, [{ userId: "u1", name: "Adam" }]);
  const online = projectSyncInfo({ row, doc: d, members: [{ userId: "u1", name: "u1", role: "owner" }] });
  expect(online.members).toEqual([{ userId: "u1", name: "Adam", role: "owner" }]);
  const offline = projectSyncInfo({ row, doc: d, members: [] });
  expect(offline.members).toEqual([{ userId: "u1", name: "Adam", role: "editor" }]);
});
