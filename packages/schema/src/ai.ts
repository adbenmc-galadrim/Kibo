import type { AppInfo } from "./app-info";

export type AiStatus = {
  available: boolean;
  reason: "missing" | "logged_out" | null;
  version: string | null;
  loggedIn: boolean | null;
  profiles: { assistant: boolean; generateur: boolean };
};

export type Environment = {
  daemon: { address: string; home: string };
  ai: AiStatus;
  git: string | null;
  gh: string | null;
  capacity: { cores: number; ramGb: number; hostSlots: number };
  github: { connected: boolean };
  app: AppInfo;
};
