import { isMoveAllowedAtLevel, maxMovePowerForLevel } from "./movePowerCap";

describe("maxMovePowerForLevel", () => {
  it("is 40 at level 1", () => {
    expect(maxMovePowerForLevel(1)).toBe(40);
  });

  it("is 150 at level 44", () => {
    expect(maxMovePowerForLevel(44)).toBe(150);
  });

  it("scales linearly between level 1 and 44", () => {
    // Halfway from level 1 to 44 (level 22.5) is halfway from 40 to 150 power.
    expect(maxMovePowerForLevel(22.5)).toBeCloseTo(95, 5);
  });

  it("stays flat at 150 beyond level 44", () => {
    expect(maxMovePowerForLevel(50)).toBe(150);
    expect(maxMovePowerForLevel(100)).toBe(150);
  });

  it("clamps below level 1 to the level-1 floor", () => {
    expect(maxMovePowerForLevel(0)).toBe(40);
  });
});

describe("isMoveAllowedAtLevel", () => {
  function buildMove(name: string, power: string) {
    return { name: { english: name }, power };
  }

  it("allows a move whose power is at or under the level's cap", () => {
    expect(isMoveAllowedAtLevel(buildMove("Ember", "40"), 1)).toBe(true);
  });

  it("rejects a move whose power exceeds the level's cap", () => {
    expect(isMoveAllowedAtLevel(buildMove("Hyper Beam", "150"), 1)).toBe(false);
  });

  it("tolerates the vendored data's trailing '*' footnote", () => {
    expect(isMoveAllowedAtLevel(buildMove("Tackle", "40*"), 1)).toBe(true);
    expect(isMoveAllowedAtLevel(buildMove("Double-Edge", "120*"), 1)).toBe(false);
  });

  it("always allows moves with no numeric power (status, fixed/variable damage)", () => {
    expect(isMoveAllowedAtLevel(buildMove("Growl", "—"), 1)).toBe(true);
    expect(isMoveAllowedAtLevel(buildMove("Seismic Toss", "—"), 1)).toBe(true);
  });

  it("always allows Self-Destruct, Explosion, and Misty Explosion regardless of level", () => {
    expect(isMoveAllowedAtLevel(buildMove("Self-Destruct", "200"), 1)).toBe(true);
    expect(isMoveAllowedAtLevel(buildMove("Explosion", "250"), 1)).toBe(true);
    expect(isMoveAllowedAtLevel(buildMove("Misty Explosion", "100"), 1)).toBe(true);
  });
});
