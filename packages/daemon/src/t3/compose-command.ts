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

export function displayFolder(folder: string, home: string): string {
  if (folder === home) return "~";
  return folder.startsWith(`${home}/`) ? `~/${folder.slice(home.length + 1)}` : folder;
}

const quoteFolder = (folder: string): string =>
  folder.startsWith("~/") ? `~/${quoteArg(folder.slice(2))}` : quoteArg(folder);

export const displayThreadStart = (input: { folder: string; key: string; home: string }): string =>
  `t3 thread start ${quoteFolder(displayFolder(input.folder, input.home))} ${quoteArg(deliveryBrief(input.key))}`;
