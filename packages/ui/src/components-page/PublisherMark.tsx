import { CircleCheck, TriangleAlert } from "lucide-react";
import { AMBER_TEXT, GREEN_TEXT } from "./market-tones";

export function PublisherMark({
  verified,
  className = "size-3.5",
}: {
  verified: boolean;
  className?: string;
}) {
  const Icon = verified ? CircleCheck : TriangleAlert;
  return <Icon aria-hidden className={`shrink-0 ${className} ${verified ? GREEN_TEXT : AMBER_TEXT}`} />;
}
