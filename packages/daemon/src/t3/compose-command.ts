import { deliveryBrief } from "@kibo/schema";

export function composeThreadStart(input: {
  bin: string;
  folder: string;
  key: string;
  title: string;
}): string[] {
  return [
    input.bin,
    "thread",
    "start",
    input.folder,
    deliveryBrief(input.key),
    "--title",
    `${input.key} · ${input.title}`,
    "--json",
  ];
}

const quoteArg = (arg: string): string =>
  /[\s"'$`\\]/.test(arg) ? `"${arg.replace(/(["$`\\])/g, "\\$1")}"` : arg;

export const shellQuote = (argv: readonly string[]): string => argv.map(quoteArg).join(" ");
