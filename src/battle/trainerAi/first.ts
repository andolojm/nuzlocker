import type { TrainerAiContext, TrainerAiImplementation } from "./types";

/** Always uses the first usable move; switches when forced or with nothing usable. */
function chooseMove(ctx: TrainerAiContext): string {
  const { request } = ctx;

  if (request.forceSwitch) return request.switches[0]?.choice ?? "move 1";

  const usable = request.moves.filter((move) => !move.disabled);
  if (usable.length === 0) return request.switches[0]?.choice ?? "move 1";

  return usable[0].choice;
}

export const firstTrainerAi: TrainerAiImplementation = {
  id: "first",
  label: "First",
  chooseMove,
};
