import { MousePointerClick } from "lucide-react";
import { frPrs } from "./fr-prs";
import type { LegendItem } from "./GraphLegend";
import { CI_MARK, ReviewMark } from "./PrNode";
import type { PrReviewTone } from "./pr-stacks";

const TONES: readonly PrReviewTone[] = ["draft", "waiting", "changes", "approved"];
const CHECKS = ["ok", "error", "running"] as const;

export const PRS_LEGEND: readonly LegendItem[] = [
  ...TONES.map((tone) => ({
    key: tone,
    label: frPrs.review[tone],
    mark: <ReviewMark tone={tone} size={8} />,
  })),
  ...CHECKS.map((check) => {
    const { Icon, color } = CI_MARK[check];
    return {
      key: `ci-${check}`,
      label: frPrs.ci[check],
      mark: <Icon size={12} absoluteStrokeWidth className={`shrink-0 ${color}`} />,
    };
  }),
  {
    key: "link",
    label: frPrs.legend.link,
    mark: <span className="h-3 w-0.5 shrink-0 bg-(--tracking-faint)" />,
  },
  {
    key: "session",
    label: frPrs.legend.session,
    mark: <span className="size-2 shrink-0 rounded-full bg-(--tracking-brand)" />,
  },
  {
    key: "click",
    label: frPrs.legend.click,
    mark: <MousePointerClick size={12} absoluteStrokeWidth className="shrink-0 text-(--tracking-mfg)" />,
  },
];
