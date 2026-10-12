import type { OverlapDetail, OverlapKind, WorkspaceRun } from "@kibo/schema";
import type { Candidate, CandidateSide } from "./compare";

export type Finding = {
  kind: OverlapKind;
  key: string;
  ownerWorkspace: string;
  otherWorkspace: string;
  ownerRunId: string;
  otherRunId: string;
  detail: OverlapDetail;
};

export const startedFirst = (x: WorkspaceRun, y: WorkspaceRun): boolean =>
  x.startedAt !== y.startedAt ? x.startedAt < y.startedAt : x.runId < y.runId;

const detailOf = (c: Candidate, owner: CandidateSide, other: CandidateSide): OverlapDetail => {
  if (c.kind === "file") return { kind: "file", path: owner.path };
  if (c.kind === "export") {
    return { kind: "export", name: c.name ?? "", ownerPath: owner.path, otherPath: other.path };
  }
  return {
    kind: "block",
    ownerPath: owner.path,
    ownerStart: owner.start ?? 1,
    otherPath: other.path,
    otherStart: other.start ?? 1,
    lines: c.lines ?? 1,
    chars: c.chars ?? 0,
  };
};

export function assignRoles(c: Candidate, a: WorkspaceRun, b: WorkspaceRun, writer: string | null): Finding {
  const aIsOwner = writer === b.key ? true : writer === a.key ? false : startedFirst(a, b);
  const [owner, other] = aIsOwner ? [a, b] : [b, a];
  const [ownerSide, otherSide] = aIsOwner ? [c.a, c.b] : [c.b, c.a];
  return {
    kind: c.kind,
    key: c.key,
    ownerWorkspace: owner.key,
    otherWorkspace: other.key,
    ownerRunId: owner.runId,
    otherRunId: other.runId,
    detail: detailOf(c, ownerSide, otherSide),
  };
}
