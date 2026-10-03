import { z } from "zod";
import { staticCheck } from "./static-check";

const [root, copy] = process.argv.slice(2);
if (!root || !copy) throw new Error("usage: static-check <toolchain> <copy>");
const files = z.array(z.string()).parse(JSON.parse(await Bun.stdin.text()));
await staticCheck(root, copy, files, (step) => process.stdout.write(`${JSON.stringify(step)}\n`));
