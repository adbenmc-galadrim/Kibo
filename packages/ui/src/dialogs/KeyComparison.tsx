import { useEffect, useState } from "react";
import { keyFingerprintHex } from "../lib/fingerprint";

export type KeyLine = { label: string; publicKey: string; name?: string | null; mismatch?: boolean };
type Props = { lines: KeyLine[]; format(hex: string): string; className?: string };

function usePrints(keys: string[]): (string | null)[] | null {
  const [prints, setPrints] = useState<(string | null)[] | null>(null);
  const joined = keys.join("\n");
  useEffect(() => {
    let live = true;
    setPrints(null);
    Promise.all(joined.split("\n").map(keyFingerprintHex)).then(
      (all) => live && setPrints(all),
      (e: unknown) => console.error("[kibo-ui] key fingerprint failed", e),
    );
    return () => {
      live = false;
    };
  }, [joined]);
  return prints;
}

export function KeyComparison({ lines, format, className }: Props) {
  const prints = usePrints(lines.map((l) => l.publicKey));
  if (!prints) return null;
  const shown = lines.flatMap((line, i) => {
    const hex = prints[i];
    return hex ? [{ ...line, text: line.name ? `${format(hex)} (${line.name})` : format(hex) }] : [];
  });
  if (shown.length === 0) return null;
  return (
    <dl
      className={`grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border bg-muted/40 p-3 font-mono text-xs ${className ?? ""}`}
    >
      {shown.map((line) => (
        <div key={line.label} className="contents">
          <dt className={line.mismatch ? "text-destructive" : "text-muted-foreground"}>{line.label}</dt>
          <dd className={`break-all ${line.mismatch ? "text-destructive" : ""}`}>{line.text}</dd>
        </div>
      ))}
    </dl>
  );
}
