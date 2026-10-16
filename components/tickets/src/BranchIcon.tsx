import { cn } from "@kibo/sdk/lib/utils";
import { Icon, type IconNode, type LucideProps } from "lucide-react";

const BRANCH: IconNode = [
  ["line", { x1: "6", x2: "6", y1: "3", y2: "15", key: "trunk" }],
  ["circle", { cx: "18", cy: "6", r: "3", key: "head" }],
  ["circle", { cx: "6", cy: "18", r: "3", key: "base" }],
  ["path", { d: "M18 9a9 9 0 0 1-9 9", key: "fork" }],
];

export function BranchIcon({ className, ...props }: LucideProps) {
  return <Icon iconNode={BRANCH} className={cn("lucide-git-branch", className)} {...props} />;
}
