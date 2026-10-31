import type {
  CiRun,
  ComponentFormat,
  ProjectAsset,
  ProjectCommand,
  ProjectEditRequest,
  ProjectEvent,
  ProjectSnapshot,
  Selection,
  Spotlight,
  StorybookOrigin,
  Surface,
  TrackingSettings,
} from "@kibo/schema";
import type { MockFetch } from "./mock-calls";
import type { MockFrame } from "./mock-design";
import type { MockHold } from "./mock-holds";
import type { MockT3 } from "./mock-t3";
import type { FileTarget, KiboSdk, NewTicketDefaults, ProjectBackend } from "./types";

export type MockSdk = {
  sdk: KiboSdk;
  backend: ProjectBackend;
  violations: string[];
  used: string[];
  opened: string[];
  newTicketRequests: NewTicketDefaults[];
  openedFiles: FileTarget[];
  openedViews: string[];
  viewRequests: { componentId: string; question: string | null; intent?: Spotlight }[];
  openedSprints: string[];
  projectEdits: ProjectEditRequest[];
  toasts: string[];
  data: Map<string, unknown>;
  configPatches: Record<string, unknown>[];
  run(cmd: ProjectCommand): unknown;
  snapshot(): ProjectSnapshot;
  focusRequests: boolean[];
  selections: (Selection | null)[];
  setVisible(visible: boolean): void;
  setFocus(active: boolean): void;
  setSelection(selection: Selection | null): void;
  setSpotlight(spotlight: Spotlight | null): void;
  setTracking(tracking: TrackingSettings | null): void;
};
export type MockSdkOptions = {
  today?: string;
  tracking?: TrackingSettings | null;
  seed?: (run: (cmd: ProjectCommand) => unknown) => void;
  holds?: MockHold[];
  viewer?: string;
  config?: Record<string, unknown>;
  surface?: Surface;
  format?: ComponentFormat;
  fetch?: MockFetch;
  ciRuns?: CiRun[];
  events?: ProjectEvent[];
  description?: string | null;
  client?: string | null;
  folder?: string | null;
  assets?: ProjectAsset[];
  t3?: MockT3;
  frames?: MockFrame[];
  storybooks?: StorybookOrigin[];
  visible?: boolean;
  focus?: boolean;
  selection?: Selection | null;
  spotlight?: Spotlight | null;
};
