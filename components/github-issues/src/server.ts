import { adapterActions } from "@kibo/sdk/adapter";
import { defineServer } from "@kibo/sdk/server";
import { githubIssuesAdapter } from "./adapter";

export const server = defineServer({ actions: adapterActions(githubIssuesAdapter) });
