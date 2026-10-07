const HEADING = /^## (\d+\.\d+\.\d+(?:-alpha\.\d+)?)(?: — .*)?$/;

type Section = { version: string; body: string };

function sections(markdown: string): Section[] {
  const out: Section[] = [];
  let current: Section | null = null;
  for (const line of markdown.split("\n")) {
    if (line.startsWith("## ")) {
      const version = HEADING.exec(line)?.[1];
      current = version ? { version, body: "" } : null;
      if (current) out.push(current);
      continue;
    }
    if (current) current.body += `${line}\n`;
  }
  return out.map((s) => ({ ...s, body: s.body.trim() }));
}

export function changelogSection(markdown: string, version: string): string | null {
  return sections(markdown).find((s) => s.version === version)?.body ?? null;
}

export const changelogVersions = (markdown: string): string[] => sections(markdown).map((s) => s.version);
