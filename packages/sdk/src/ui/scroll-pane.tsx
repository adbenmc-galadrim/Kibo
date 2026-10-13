import { createElement, type HTMLAttributes, type Ref } from "react"
import { cn } from "cn"

type ScrollPaneProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "aside" | "section" | "main" | "nav" | "ul"
  ref?: Ref<HTMLElement>
}

function ScrollPane({ as = "div", className, ...props }: ScrollPaneProps) {
  return createElement(as, {
    "data-slot": "scroll-pane",
    className: cn("min-h-0 overflow-x-hidden overflow-y-auto scrollbar-thin", className),
    ...props,
  })
}

export { ScrollPane }
