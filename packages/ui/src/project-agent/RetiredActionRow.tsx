import type { ActionResult } from "@kibo/schema";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { Outcome } from "./BatchActionRow";

export function RetiredActionRow({ result }: { result: ActionResult | undefined }) {
  return (
    <li className="grid gap-[3px] px-3.5 py-2.5">
      <p className="text-[13px] leading-[16px] text-zinc-400 dark:text-zinc-500">
        {frProjectAgent.batch.retired}
      </p>
      {result && <Outcome result={result} />}
    </li>
  );
}
