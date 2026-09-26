import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildFakeMcpServer } from "./fake-mcp";

await buildFakeMcpServer().connect(new StdioServerTransport());
