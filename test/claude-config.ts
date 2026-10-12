import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.CLAUDE_CONFIG_DIR = mkdtempSync(join(tmpdir(), "kibo-test-claude-"));
delete process.env.CLAUDE_CODE_PLUGIN_CACHE_DIR;
