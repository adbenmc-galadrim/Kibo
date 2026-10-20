import { lazyPanel } from "@kibo/sdk";
import { frLazy } from "./fr-lazy";

export const GraphView = lazyPanel(() => import("./GraphView").then((m) => m.GraphView), frLazy);

export const GraphWidget = lazyPanel(() => import("./GraphWidget").then((m) => m.GraphWidget), frLazy);
