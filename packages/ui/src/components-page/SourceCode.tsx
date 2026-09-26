import { Button } from "@kibo/sdk/ui/button";
import { useEffect, useState } from "react";
import { CodeLines } from "../files/CodeLines";
import { highlightLines, languageOf, plainTokens, type Token } from "../files/highlight";
import { fr } from "../i18n/fr";

type File = { path: string; content: string };

function useTokens(file: File | undefined): Token[][] {
  const [tokens, setTokens] = useState<Token[][]>([]);
  useEffect(() => {
    if (!file) {
      setTokens([]);
      return;
    }
    setTokens(plainTokens(file.content));
    let live = true;
    highlightLines(file.content, languageOf(file.path).id)
      .then((t) => {
        if (live) setTokens(t);
      })
      .catch((e: unknown) => console.error("[kibo-ui] highlight failed", e));
    return () => {
      live = false;
    };
  }, [file]);
  return tokens;
}

const firstPath = (files: File[]) => files.find((f) => f.path === "ui.tsx")?.path ?? files[0]?.path ?? "";

export function SourceCode({ files }: { files: File[] }) {
  const [path, setPath] = useState(() => firstPath(files));
  const current = files.find((f) => f.path === path);
  const tokens = useTokens(current);
  return (
    <div className="grid h-96 shrink-0 grid-cols-[11rem_1fr] overflow-hidden rounded-lg border">
      <nav
        aria-label={fr.market.files}
        className="flex flex-col gap-0.5 overflow-auto border-r bg-muted/30 p-1"
      >
        {files.map((f) => (
          <Button
            key={f.path}
            size="sm"
            variant={f.path === path ? "secondary" : "ghost"}
            className="h-7 justify-start truncate font-mono text-2xs"
            onClick={() => setPath(f.path)}
          >
            {f.path}
          </Button>
        ))}
      </nav>
      {current && <CodeLines tokens={tokens} highlightLine={null} label={current.path} />}
    </div>
  );
}
