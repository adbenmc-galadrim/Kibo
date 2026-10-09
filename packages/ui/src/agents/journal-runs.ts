import type { RunView } from "@kibo/schema";
import { createContext } from "react";

export type JournalRun = Pick<RunView, "id" | "label" | "turns">;

export const JournalRuns = createContext<readonly JournalRun[]>([]);
