/**
 * @jest-environment jsdom
 */
import { PikaLocal } from "../api/pikaLocal";
import type { Move, TM } from "../api/pikaserve";
import { GameStateEngine } from "./gameStateEngine";
import { CATCH_TM_COUNT, VICTORY_TM_COUNT, awardCatchTM, awardVictoryTMs } from "./tmRewards";

function buildMove(overrides: Partial<Move> = {}): Move {
  return {
    id: "5",
    name: { english: "Mega Punch" },
    type: "Normal",
    category: "Physical",
    pp: "20",
    power: "80",
    accuracy: "85%",
    ...overrides,
  };
}

function buildTM(overrides: Partial<TM> = {}): TM {
  return { id: 5, move: buildMove(), ...overrides };
}

describe("awardVictoryTMs / awardCatchTM", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it("awardVictoryTMs fetches VICTORY_TM_COUNT random TMs and adds them all to the engine", async () => {
    const engine = new GameStateEngine();
    const randomSpy = jest
      .spyOn(PikaLocal, "getRandomTM")
      .mockResolvedValueOnce(buildTM({ id: 5, move: buildMove() }))
      .mockResolvedValueOnce(buildTM({ id: 6, move: buildMove({ id: "6", name: { english: "Growl" } }) }));

    const awarded = await awardVictoryTMs(engine);

    expect(randomSpy).toHaveBeenCalledTimes(VICTORY_TM_COUNT);
    expect(awarded).toHaveLength(2);
    expect(engine.current.tms).toEqual(awarded);
    expect(engine.current.tms.map((tm) => tm.move.name.english)).toEqual(["Mega Punch", "Growl"]);
  });

  it("awardCatchTM fetches CATCH_TM_COUNT random TM(s)", async () => {
    const engine = new GameStateEngine();
    const randomSpy = jest.spyOn(PikaLocal, "getRandomTM").mockResolvedValue(buildTM());

    const awarded = await awardCatchTM(engine);

    expect(randomSpy).toHaveBeenCalledTimes(CATCH_TM_COUNT);
    expect(engine.current.tms).toEqual(awarded);
    expect(engine.current.tms).toHaveLength(1);
  });

  it("appends to any TMs the engine already had", async () => {
    const engine = new GameStateEngine();
    engine.addTM({ id: 99, move: buildMove({ name: { english: "Cut" } }) });
    jest.spyOn(PikaLocal, "getRandomTM").mockResolvedValue(buildTM());

    await awardCatchTM(engine);

    expect(engine.current.tms).toHaveLength(2);
    expect(engine.current.tms[0].move.name.english).toBe("Cut");
  });
});
