#!/usr/bin/env bun
import { cliIo, runCli } from "./index";

process.exit(await runCli(process.argv.slice(2), cliIo()));
