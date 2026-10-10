import { renderMarkdownLite } from "@kibo/sdk";

export function MessageMoment({ text }: { text: string }) {
  return <div className="text-sm leading-relaxed break-words">{renderMarkdownLite(text)}</div>;
}
