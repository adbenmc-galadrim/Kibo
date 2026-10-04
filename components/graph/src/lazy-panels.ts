import { lazyPanel } from "@kibo/sdk";
import { fr } from "./fr";

export const GraphView = lazyPanel(() => import("./GraphView").then((m) => m.GraphView), fr.lazy);

export const GraphFramed = lazyPanel(() => import("./GraphFramed").then((m) => m.GraphFramed), fr.lazy);

export const GraphWidget = lazyPanel(() => import("./GraphWidget").then((m) => m.GraphWidget), fr.lazy);
