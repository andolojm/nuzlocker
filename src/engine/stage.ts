export const StageType = {
  InitialChoice: "initial-choice",
  Battle: "battle",
  Catch: "catch",
} as const;

export type StageType = (typeof StageType)[keyof typeof StageType];

export interface Stage {
  type: StageType;
  description: string;
  /** One strength value per opposing Pokemon (see encounterPokemon). Only set for Battle stages. */
  opponentTeam?: number[];
  /** Strength passed to encounterPokemon to constrain the wild Pokemon's bst. Only set for Catch stages. */
  strength?: number;
  /** Catch-rate ball multiplier for this stage's catch attempt (Poké Ball = 1). Catch stages only. */
  ballBonus?: number;
  /** Level assigned to every Pokemon on the opponent's side of this stage's battle. */
  level: number;
  /** Max level the player's own Pokemon may be leveled up to at this stage. */
  cap: number;
}
