import type { TrainerAiContext, TrainerAiImplementation } from "./types";

/** Picks uniformly at random among the currently-usable moves; switches when forced or with nothing usable. */
function chooseMove(ctx: TrainerAiContext): string {
  const { request } = ctx;
  const rng = ctx.rng ?? Math.random;

  if (request.forceSwitch) return request.switches[0]?.choice ?? "move 1";

  const usable = request.moves.filter((move) => !move.disabled);
  if (usable.length === 0) return request.switches[0]?.choice ?? "move 1";

  const index = Math.floor(rng() * usable.length);
  return usable[Math.min(index, usable.length - 1)].choice;
}

export const randomTrainerAi: TrainerAiImplementation = {
  id: "random",
  label: "Random",
  chooseMove,
};
