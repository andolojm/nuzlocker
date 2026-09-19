import { ScoringRule, SCORING_RULE_EXPLAINERS, scoreDelta } from "./scoring";

describe("scoring", () => {
  it("gives every scoring rule a matching guide explainer", () => {
    const ruleValues = Object.values(ScoringRule);
    const explainedRules = Object.keys(SCORING_RULE_EXPLAINERS);

    for (const rule of ruleValues) {
      expect(SCORING_RULE_EXPLAINERS[rule]).toEqual(expect.any(String));
      expect(SCORING_RULE_EXPLAINERS[rule].length).toBeGreaterThan(0);
    }
    // Catches a stale explainer left behind after a rule is renamed/removed, not just a missing one.
    expect(explainedRules.sort()).toEqual([...ruleValues].sort());
  });

  it("awards a defeated Pokemon's base stat total", () => {
    expect(scoreDelta(ScoringRule.DefeatedPokemon, 300)).toBe(300);
  });

  it("deducts half a base stat total for running from a catchable Pokemon", () => {
    expect(scoreDelta(ScoringRule.RanFromPokemon, 301)).toBe(-151);
  });

  it("deducts a flat 50 points for using a TM", () => {
    expect(scoreDelta(ScoringRule.UsedTM)).toBe(-50);
  });

  it("deducts a fainted Pokemon's base stat total", () => {
    expect(scoreDelta(ScoringRule.FaintedPokemon, 300)).toBe(-300);
  });
});
