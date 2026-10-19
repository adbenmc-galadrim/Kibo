import type { ComponentProps } from "react";
import { frChanges } from "../i18n/fr-changes";
import { BranchCommits } from "./BranchCommits";
import { CommitPanel } from "./CommitPanel";
import { PushActions } from "./PushActions";

type Props = {
  readOnly: boolean;
  commit: ComponentProps<typeof CommitPanel>;
  commits: ComponentProps<typeof BranchCommits>;
  push: ComponentProps<typeof PushActions>;
};

export function CommitColumn({ readOnly, commit, commits, push }: Props) {
  return (
    <aside className="flex min-h-0 flex-col gap-5 overflow-auto border-t p-4 lg:border-t-0 lg:border-l">
      {readOnly ? (
        <p className="text-sm text-muted-foreground">{frChanges.changes.localOnly}</p>
      ) : (
        <>
          <CommitPanel {...commit} />
          <BranchCommits {...commits} />
          <PushActions {...push} />
        </>
      )}
    </aside>
  );
}
