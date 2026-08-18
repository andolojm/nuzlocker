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
}
