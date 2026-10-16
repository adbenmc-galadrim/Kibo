import { z } from "zod";

export const AgentExecution = z.enum(["hidden", "shown"]);
export type AgentExecution = z.infer<typeof AgentExecution>;

export const AppSettings = z.object({ agentExecution: AgentExecution.default("hidden") });
export type AppSettings = z.infer<typeof AppSettings>;

export const AppSettingsPatch = z.object({ agentExecution: AgentExecution.optional() }).strict();
export type AppSettingsPatch = z.infer<typeof AppSettingsPatch>;
