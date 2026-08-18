/**
 * @jest-environment jsdom
 */
import { PikaLocal } from "../api/pikaLocal";
import type { Move, TM } from "../api/pikaserve";
import { GameStateEngine } from "./gameStateEngine";
import { CATCH_TM_COUNT, VICTORY_TM_COUNT, awardCatchTM, awardVictoryTMs, resolveTM } from "./tmRewards";

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
  return {
    id: 328,
    name: { english: "TM01" },
    moveNames: ["Mega Punch"],
    ...overrides,
  };
}

describe("resolveTM", () => {
  it("resolves the TM's first move name against the given move list", () => {
    const allMoves = [buildMove(), buildMove({ id: "6", name: { english: "Growl" } })];

    const owned = resolveTM(buildTM(), allMoves);

    expect(owned).toEqual({ id: 328, name: { english: "TM01" }, move: allMoves[0] });
  });

  it("picks only the first of several alternative move names", () => {
    const tm = buildTM({ moveNames: ["Mega Punch", "Dynamic Punch", "Focus Punch"] });
    const allMoves = [buildMove(), buildMove({ id: "9", name: { english: "Dynamic Punch" } })];

    const owned = resolveTM(tm, allMoves);

    expect(owned.move.name.english).toBe("Mega Punch");
  });

  it("throws when the move name isn't found in the given list", () => {
    expect(() => resolveTM(buildTM(), [])).toThrow(/Could not resolve move/);
  });

  it("matches move names loosely across punctuation/spacing drift (e.g. old-style vs modern formatting)", () => {
    const tm = buildTM({ moveNames: ["BubbleBeam"] });
    const allMoves = [buildMove({ name: { english: "Bubble Beam" } })];

    const owned = resolveTM(tm, allMoves);

    expect(owned.move.name.english).toBe("Bubble Beam");
  });

  it("resolves every real TM/HM from the vendored data without throwing", async () => {
    const [tms, allMoves] = await Promise.all([PikaLocal.getAllTMs(), PikaLocal.getAllMoves()]);

    const unresolved = tms.filter((tm) => {
      try {
        resolveTM(tm, allMoves);
        return false;
      } catch {
        return true;
      }
    });

    expect(unresolved).toEqual([]);
  });
});

describe("awardVictoryTMs / awardCatchTM", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it("awardVictoryTMs fetches VICTORY_TM_COUNT random TMs and adds them all to the engine", async () => {
    const engine = new GameStateEngine();
    const randomSpy = jest
      .spyOn(PikaLocal, "getRandomTM")
      .mockResolvedValueOnce(buildTM({ id: 1, name: { english: "TM01" }, moveNames: ["Mega Punch"] }))
      .mockResolvedValueOnce(buildTM({ id: 2, name: { english: "TM02" }, moveNames: ["Growl"] }));
    jest
      .spyOn(PikaLocal, "getAllMoves")
      .mockResolvedValue([buildMove(), buildMove({ id: "6", name: { english: "Growl" } })]);

    const awarded = await awardVictoryTMs(engine);

    expect(randomSpy).toHaveBeenCalledTimes(VICTORY_TM_COUNT);
    expect(awarded).toHaveLength(2);
    expect(engine.current.tms).toEqual(awarded);
    expect(engine.current.tms.map((tm) => tm.move.name.english)).toEqual(["Mega Punch", "Growl"]);
  });

  it("awardCatchTM fetches CATCH_TM_COUNT random TM(s)", async () => {
    const engine = new GameStateEngine();
    const randomSpy = jest.spyOn(PikaLocal, "getRandomTM").mockResolvedValue(buildTM());
    jest.spyOn(PikaLocal, "getAllMoves").mockResolvedValue([buildMove()]);

    const awarded = await awardCatchTM(engine);

    expect(randomSpy).toHaveBeenCalledTimes(CATCH_TM_COUNT);
    expect(engine.current.tms).toEqual(awarded);
    expect(engine.current.tms).toHaveLength(1);
  });

  it("appends to any TMs the engine already had", async () => {
    const engine = new GameStateEngine();
    engine.addTM({ id: 99, name: { english: "HM01" }, move: buildMove({ name: { english: "Cut" } }) });
    jest.spyOn(PikaLocal, "getRandomTM").mockResolvedValue(buildTM());
    jest.spyOn(PikaLocal, "getAllMoves").mockResolvedValue([buildMove()]);

    await awardCatchTM(engine);

    expect(engine.current.tms).toHaveLength(2);
    expect(engine.current.tms[0].name.english).toBe("HM01");
  });
});
