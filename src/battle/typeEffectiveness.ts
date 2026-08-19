import { Dex } from "@pkmn/sim";

/** Damage multiplier for a move's type against a set of defender types (0, 0.25, 0.5, 1, 2, or 4). */
export function getEffectivenessMultiplier(moveType: string, defenderTypes: string[]): number {
  if (!Dex.getImmunity(moveType, defenderTypes)) return 0;
  return Math.pow(2, Dex.getEffectiveness(moveType, defenderTypes));
}
