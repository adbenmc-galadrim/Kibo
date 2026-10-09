import { renderMarkdownLite } from "@kibo/sdk";
import type { ReactNode } from "react";

export const renderContext = (markdown: string): ReactNode => renderMarkdownLite(markdown);
