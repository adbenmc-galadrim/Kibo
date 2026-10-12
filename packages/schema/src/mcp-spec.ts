export type McpInputSchema = { type: "object"; properties: Record<string, unknown>; required: string[] };
export type McpToolSpec = { name: string; description: string; inputSchema: McpInputSchema };
