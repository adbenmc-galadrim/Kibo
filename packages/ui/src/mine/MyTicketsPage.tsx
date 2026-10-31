import type { ComponentProps } from "react";
import { MyWorkList } from "./MyWorkList";

export function MyTicketsPage(props: ComponentProps<typeof MyWorkList>) {
  return <MyWorkList {...props} />;
}
