import { PikaLocal } from "../api/pikaLocal";
import type { Move } from "../api/pikaserve";
import { LEVEL_UP_MOVE_LEVELS, nextMoveLearnLevel, rollLearnableMove } from "./moveLearning";

function buildMove(id: string, name: string): Move {
  return { id, name: { english: name }, type: "Normal", category: "Physical", pp: "20", power: "40", accuracy: "100%" };
}

describe("nextMoveLearnLevel", () => {
  it("returns the first milestone after the given level", () => {
    expect(nextMoveLearnLevel(5)).toBe(6);
    expect(nextMoveLearnLevel(6)).toBe(10);
    expect(nextMoveLearnLevel(9)).toBe(10);
  });

  it("returns undefined once past the last milestone", () => {
    expect(nextMoveLearnLevel(65)).toBeUndefined();
    expect(nextMoveLearnLevel(100)).toBeUndefined();
  });

  it("handles a level exactly between two adjacent milestones with an unusual gap (44/48)", () => {
    expect(nextMoveLearnLevel(43)).toBe(44);
    expect(nextMoveLearnLevel(44)).toBe(48);
  });

  it("the milestone list matches the spec exactly", () => {
    expect(LEVEL_UP_MOVE_LEVELS).toEqual([6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 44, 48, 52, 56, 60, 62, 65]);
  });
});

describe("rollLearnableMove", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns the rolled move when it isn't already known", async () => {
    jest.spyOn(PikaLocal, "getRandomMove").mockResolvedValue(buildMove("2", "Growl"));

    const result = await rollLearnableMove([buildMove("1", "Tackle")]);

    expect(result).toEqual(buildMove("2", "Growl"));
  });

  it("re-rolls when the move is already known", async () => {
    const spy = jest
      .spyOn(PikaLocal, "getRandomMove")
      .mockResolvedValueOnce(buildMove("1", "Tackle"))
      .mockResolvedValueOnce(buildMove("1", "Tackle"))
      .mockResolvedValueOnce(buildMove("2", "Growl"));

    const result = await rollLearnableMove([buildMove("1", "Tackle")]);

    expect(result).toEqual(buildMove("2", "Growl"));
    expect(spy).toHaveBeenCalledTimes(3);
  });
});
