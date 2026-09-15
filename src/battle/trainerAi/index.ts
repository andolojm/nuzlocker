export * from "./types";
export { compareSpeed } from "./statMath";

import { basicTrainerAi } from "./basic";
import { firstTrainerAi } from "./first";
import { randomTrainerAi } from "./random";
import type { TrainerAiImplementation } from "./types";

export { basicTrainerAi } from "./basic";
export { randomTrainerAi } from "./random";
export { firstTrainerAi } from "./first";

/** Every trainer AI implementation selectable from the dev tools dropdown, in display order. */
export const TRAINER_AI_IMPLEMENTATIONS: TrainerAiImplementation[] = [basicTrainerAi, randomTrainerAi, firstTrainerAi];

export const DEFAULT_TRAINER_AI_ID: string = basicTrainerAi.id;

/** Looks up a trainer AI implementation by id, falling back to the default if the id is unknown (e.g. stale/removed persisted setting). */
export function getTrainerAiImplementation(id: string | null | undefined): TrainerAiImplementation {
  return TRAINER_AI_IMPLEMENTATIONS.find((impl) => impl.id === id) ?? basicTrainerAi;
}
