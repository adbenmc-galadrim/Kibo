import { readFileSync } from "node:fs";

export function Component() {
  return <p>{String(readFileSync)}</p>;
}
