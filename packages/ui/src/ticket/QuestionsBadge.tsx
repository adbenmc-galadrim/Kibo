import { QuestionsChip, type QuestionsChipProps } from "@kibo/sdk";
import { frQuestions } from "../i18n/fr-questions";

type Props = Omit<QuestionsChipProps, "text" | "label" | "title" | "className"> & { count: number };

export function QuestionsBadge({ count, ...chip }: Props) {
  if (count <= 0) return null;
  return (
    <QuestionsChip
      {...chip}
      text={frQuestions.badge(count)}
      title={frQuestions.open}
      className="rounded-md px-2 py-0.5 text-xs [&_svg]:size-3.5"
    />
  );
}
