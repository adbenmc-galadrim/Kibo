import { DELIVERY_STEP_MAX } from "@kibo/schema";

export const phaseLabel = (step: number, name: string): string =>
  `Phase ${step}/${DELIVERY_STEP_MAX + 1} · ${name}`;
