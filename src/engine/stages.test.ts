import { StageType } from "./stage";
import { STAGES, buildOpponentTeam } from "./stages";

describe("STAGES", () => {
  it("only makes the very first stage an InitialChoice", () => {
    expect(STAGES[0].type).toBe(StageType.InitialChoice);
    expect(STAGES.slice(1).every((stage) => stage.type !== StageType.InitialChoice)).toBe(true);
  });

  it("gives every stage non-empty descriptive text", () => {
    for (const stage of STAGES) {
      expect(stage.description.length).toBeGreaterThan(0);
    }
  });

  it("only gives Battle stages an opponentTeam", () => {
    for (const stage of STAGES) {
      if (stage.type === StageType.Battle) {
        expect(stage.opponentTeam).toBeDefined();
      } else {
        expect(stage.opponentTeam).toBeUndefined();
      }
    }
  });

  it("only gives Catch stages a strength", () => {
    for (const stage of STAGES) {
      if (stage.type === StageType.Catch) {
        expect(stage.strength).toBeDefined();
      } else {
        expect(stage.strength).toBeUndefined();
      }
    }
  });

  it("scales Catch stage strength from 300 to 550 over the course of the run", () => {
    const catchStrengths = STAGES.filter((stage) => stage.type === StageType.Catch).map((stage) => stage.strength);

    expect(catchStrengths[0]).toBe(300);
    expect(catchStrengths[catchStrengths.length - 1]).toBe(550);
    // Strictly increasing: each catch stage's wild encounters should be at least as tough as the last.
    for (let i = 1; i < catchStrengths.length; i++) {
      expect(catchStrengths[i]!).toBeGreaterThan(catchStrengths[i - 1]!);
    }
  });
});

describe("buildOpponentTeam", () => {
  it("returns one strength value per requested team member", () => {
    const team = buildOpponentTeam(4, 400, () => 0.5);
    expect(team).toHaveLength(4);
  });

  it("varies each value by up to 15% of the base strength", () => {
    const random = jest
      .fn<number, []>()
      .mockReturnValueOnce(1) // +15%
      .mockReturnValueOnce(0); // -15%

    const team = buildOpponentTeam(2, 400, random);

    expect(team).toEqual([460, 340]);
  });

  it("defaults to Math.random when no injectable RNG is given", () => {
    const team = buildOpponentTeam(3, 400);
    for (const strength of team) {
      expect(strength).toBeGreaterThanOrEqual(400 * 0.85);
      expect(strength).toBeLessThanOrEqual(400 * 1.15);
    }
  });
});
