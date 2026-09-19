/**
 * Every way the current run's score can change. New rules can be added here as their own entry —
 * SCORING_RULE_EXPLAINERS and scoreDelta must each grow a matching case, which scoring.test.ts
 * enforces (see its "every rule has an explainer" test) without pinning down the actual copy.
 */
export const ScoringRule = {
  DefeatedPokemon: "defeated-pokemon",
  RanFromPokemon: "ran-from-pokemon",
  UsedTM: "used-tm",
  FaintedPokemon: "fainted-pokemon",
} as const;

export type ScoringRule = (typeof ScoringRule)[keyof typeof ScoringRule];

/** Guide-page copy for each rule, keyed so every rule is guaranteed a matching explainer. */
export const SCORING_RULE_EXPLAINERS: Record<ScoringRule, string> = {
  [ScoringRule.DefeatedPokemon]:
    "Defeat a trainer's Pokémon in battle, or catch a wild one: gain its base stat total in points.",
  [ScoringRule.RanFromPokemon]:
    "Run from a wild Pokémon you could have caught: lose half its base stat total.",
  [ScoringRule.UsedTM]: "Teach a Pokémon a TM: lose 50 points.",
  [ScoringRule.FaintedPokemon]: "One of your own Pokémon faints: lose its base stat total.",
};

/** Points a scoring event is worth. `bst` (base stat total) is required for rules whose value scales with it. */
export function scoreDelta(rule: ScoringRule, bst = 0): number {
  switch (rule) {
    case ScoringRule.DefeatedPokemon:
      return bst;
    case ScoringRule.RanFromPokemon:
      return -Math.round(bst / 2);
    case ScoringRule.UsedTM:
      return -50;
    case ScoringRule.FaintedPokemon:
      return -bst;
  }
}
