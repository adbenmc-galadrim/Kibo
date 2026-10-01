import type { ComponentProps } from "react";
import { fr } from "../i18n/fr";
import { CommitPanel } from "./CommitPanel";
import { PushActions } from "./PushActions";
import { UnpushedCommits } from "./UnpushedCommits";

type Props = {
  readOnly: boolean;
  commit: ComponentProps<typeof CommitPanel>;
  unpushed: ComponentProps<typeof UnpushedCommits>;
  push: ComponentProps<typeof PushActions>;
};

export function CommitColumn({ readOnly, commit, unpushed, push }: Props) {
  return (
    <aside className="flex min-h-0 flex-col gap-5 overflow-auto border-t p-4 lg:border-t-0 lg:border-l">
      {readOnly ? (
        <p className="text-sm text-muted-foreground">{fr.changes.localOnly}</p>
      ) : (
        <>
          <CommitPanel {...commit} />
          <UnpushedCommits {...unpushed} />
          <PushActions {...push} />
        </>
      )}
    </aside>
  );
}
