import { previewBlocks } from "./preview";

export function GuidelinePreview({ content }: { content: string }) {
  return (
    <div className="grid content-start gap-2 text-sm">
      {previewBlocks(content).map((b, i) => {
        const key = `${i}-${b.kind}`;
        if (b.kind === "h1")
          return (
            <h3 key={key} className="text-lg font-semibold">
              {b.text}
            </h3>
          );
        if (b.kind === "h2")
          return (
            <h4 key={key} className="font-semibold">
              {b.text}
            </h4>
          );
        if (b.kind === "li")
          return (
            <p key={key} className="pl-4 before:-ml-3 before:mr-2 before:content-['•']">
              {b.text}
            </p>
          );
        return <p key={key}>{b.text}</p>;
      })}
    </div>
  );
}
