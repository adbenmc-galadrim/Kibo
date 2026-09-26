import { type Binding, KiboError, type MappedRemote, type PushOp, type SyncedFields } from "@kibo/schema";
import type { AdapterRunner } from "../../integrations/types";

type Issue = { number: number; fields: SyncedFields; updatedAt: string; labels: string[]; gone: boolean };
export type MemoryRunner = AdapterRunner & {
  issues: Map<number, Issue>;
  pulls: number;
  pushes: PushOp[];
  add(fields: Partial<SyncedFields> & { title: string }, labels?: string[]): Issue;
  edit(n: number, patch: Partial<SyncedFields>): void;
  failNext(error: KiboError, times?: number): void;
};

export function createMemoryRunner(clock: { now: number }): MemoryRunner {
  let seq = 0;
  let failures: { error: KiboError; times: number } | null = null;
  const iso = () => new Date(clock.now).toISOString().replace(/\.\d{3}Z$/, "Z");
  const mapped = (b: Binding, i: Issue): MappedRemote => ({
    remoteId: String(i.number),
    updatedAt: i.updatedAt,
    fields: i.fields,
    labels: i.labels,
    ref: {
      kind: "github_issue",
      bindingId: b.id,
      repo: b.config.repo,
      number: i.number,
      nodeId: `I_${i.number}`,
      url: `https://github.com/${b.config.repo}/issues/${i.number}`,
    },
  });
  const maybeFail = () => {
    if (!failures) return;
    failures.times -= 1;
    const e = failures.error;
    if (failures.times <= 0) failures = null;
    throw e;
  };
  const r: MemoryRunner = {
    issues: new Map(),
    pulls: 0,
    pushes: [],
    add(fields, labels = []) {
      seq += 1;
      clock.now += 1000;
      const statusId = fields.closed ? "done" : (fields.statusId ?? "todo");
      const issue: Issue = {
        number: seq,
        fields: {
          title: fields.title,
          description: fields.description ?? "",
          statusId,
          closed: statusId === "done",
        },
        updatedAt: iso(),
        labels,
        gone: false,
      };
      r.issues.set(seq, issue);
      return issue;
    },
    edit(n, patch) {
      const i = r.issues.get(n);
      if (!i) throw new Error(`no issue ${n}`);
      clock.now += 1000;
      const fields = { ...i.fields, ...patch };
      const statusId = fields.closed ? "done" : fields.statusId === "done" ? "todo" : fields.statusId;
      i.fields = { ...fields, statusId, closed: statusId === "done" };
      i.updatedAt = iso();
    },
    failNext(error, times = 1) {
      failures = { error, times };
    },
    async pull(_projectId, binding, cursor) {
      r.pulls += 1;
      maybeFail();
      const items = [...r.issues.values()]
        .filter((i) => !i.gone && (cursor === null || i.updatedAt >= cursor))
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
      return {
        items: items.map((i) => mapped(binding, i)),
        cursor: items.at(-1)?.updatedAt ?? cursor,
        more: false,
      };
    },
    async push(_projectId, binding, op) {
      r.pushes.push(op);
      maybeFail();
      if (op.kind === "create") return mapped(binding, r.add(op.fields));
      const issue = r.issues.get(Number(op.remoteId));
      if (!issue || issue.gone) throw new KiboError("REMOTE_NOT_FOUND", `issue ${op.remoteId}`);
      r.edit(issue.number, op.patch);
      return mapped(binding, issue);
    },
  };
  return r;
}
