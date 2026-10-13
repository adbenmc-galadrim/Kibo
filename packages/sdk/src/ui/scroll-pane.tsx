import type { HTMLAttributes } from "react"
import { cn } from "cn"

type ScrollPaneProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "aside" | "section" | "main" | "nav" | "ul"
}

function ScrollPane({ as: Tag = "div", className, ...props }: ScrollPaneProps) {
  return (
    <Tag
      data-slot="scroll-pane"
      className={cn("min-h-0 overflow-x-hidden overflow-y-auto scrollbar-thin", className)}
      {...props}
    />
  )
}

export { ScrollPane }
