/**
 * Standard Gen III+ stat formula, simplified for 0 EVs / neutral nature — matches what
 * battleSimulator.ts already feeds @pkmn/sim (see NEUTRAL_EVS, nature: "Serious"), so this mirrors
 * what the sim computes internally during battle.
 */
export function calculateStat(base: number, iv: number, level: number, isHp: boolean): number {
  const core = Math.floor(((2 * base + iv) * level) / 100);
  return isHp ? core + level + 10 : core + 5;
}
