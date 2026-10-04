import { guardDestructiveKeys } from "@kibo/sdk/key-guard";
import { useEffect } from "react";

export function useDestructiveKeyGuard(): void {
  useEffect(() => guardDestructiveKeys(), []);
}
