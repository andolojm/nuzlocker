import { Dex } from "@pkmn/sim";
import type { BattleRequest } from "./battleSimulator";

export interface Combatant {
  types: string[];
}

export interface TrainerAiContext {
  request: BattleRequest;
  /** The AI's own active Pokemon. */
  attacker: Combatant;
  /** The player's active Pokemon. */
  defender: Combatant;
  /** Injectable for deterministic tests; defaults to Math.random. */
  rng?: () => number;
}

const STATUS_MOVE_BASELINE = 45;
const NO_POWER_MOVE_BASELINE = 60;
const JITTER_RANGE = 0.2;

function scoreMove(moveName: string, attacker: Combatant, defender: Combatant, rng: () => number): number {
  const moveData = Dex.moves.get(moveName);
  let score: number;

  if (moveData.category === "Status") {
    score = STATUS_MOVE_BASELINE;
  } else {
    const immune = !Dex.getImmunity(moveData.type, defender.types);
    if (immune) return 0;

    const multiplier = Math.pow(2, Dex.getEffectiveness(moveData.type, defender.types));
    const stab = attacker.types.includes(moveData.type) ? 1.5 : 1;
    const accuracy = typeof moveData.accuracy === "number" ? moveData.accuracy : 100;
    const basePower = moveData.basePower || NO_POWER_MOVE_BASELINE;
    score = basePower * multiplier * stab * (accuracy / 100);
  }

  const jitter = 1 - JITTER_RANGE / 2 + rng() * JITTER_RANGE;
  return score * jitter;
}

/** Picks the opposing trainer's move: favors super-effective/STAB damage, avoids immune moves. */
export function chooseTrainerMove(ctx: TrainerAiContext): string {
  const { request, attacker, defender } = ctx;
  const rng = ctx.rng ?? Math.random;

  if (request.forceSwitch) return request.switches[0]?.choice ?? "move 1";

  const usable = request.moves.filter((move) => !move.disabled);
  if (usable.length === 0) return request.switches[0]?.choice ?? "move 1";

  let best = usable[0];
  let bestScore = -Infinity;
  for (const move of usable) {
    const score = scoreMove(move.name, attacker, defender, rng);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best.choice;
}
