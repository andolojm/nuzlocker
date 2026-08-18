import { calculateStat } from "./stats";

describe("calculateStat", () => {
  it("matches the known Garchomp reference value (base 130 Attack, IV 31, level 100, neutral)", () => {
    expect(calculateStat(130, 31, 100, false)).toBe(296);
  });

  it("adds level + 10 for HP but not for other stats", () => {
    expect(calculateStat(45, 31, 50, true)).toBe(Math.floor(((2 * 45 + 31) * 50) / 100) + 50 + 10);
    expect(calculateStat(45, 31, 50, false)).toBe(Math.floor(((2 * 45 + 31) * 50) / 100) + 5);
  });

  it("handles level 1", () => {
    expect(calculateStat(45, 0, 1, true)).toBe(Math.floor((2 * 45 * 1) / 100) + 1 + 10);
    expect(calculateStat(45, 0, 1, false)).toBe(Math.floor((2 * 45 * 1) / 100) + 5);
  });

  it("0 IV still contributes nothing extra beyond base doubling", () => {
    expect(calculateStat(100, 0, 100, false)).toBe(Math.floor((2 * 100 * 100) / 100) + 5);
  });
});
