/**
 * @jest-environment jsdom
 */
import { PikaLocal } from "../api/pikaLocal";
import type { Item } from "../api/pikaserve";
import { CATCH_BERRY_COUNT, VICTORY_BERRY_COUNT, awardCatchBerries, awardVictoryBerries } from "./berryRewards";
import { GameStateEngine } from "./gameStateEngine";

function buildBerry(overrides: Partial<Item> = {}): Item {
  return {
    id: 158,
    type: "Berries",
    description: "Restores HP when the holder's HP falls below half.",
    name: { english: "Sitrus Berry" },
    ...overrides,
  };
}

describe("awardVictoryBerries / awardCatchBerries", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it("awardVictoryBerries draws VICTORY_BERRY_COUNT random berries into the bag", async () => {
    const engine = new GameStateEngine();
    const randomSpy = jest
      .spyOn(PikaLocal, "getRandomBerry")
      .mockResolvedValueOnce(buildBerry())
      .mockResolvedValueOnce(buildBerry({ id: 157, name: { english: "Lum Berry" } }))
      .mockResolvedValueOnce(buildBerry({ id: 201, name: { english: "Liechi Berry" } }));

    const awarded = await awardVictoryBerries(engine);

    expect(randomSpy).toHaveBeenCalledTimes(VICTORY_BERRY_COUNT);
    expect(engine.current.bag).toEqual(awarded);
    expect(engine.current.bag.map((berry) => berry.name.english)).toEqual([
      "Sitrus Berry",
      "Lum Berry",
      "Liechi Berry",
    ]);
  });

  it("awardCatchBerries draws CATCH_BERRY_COUNT random berry/berries", async () => {
    const engine = new GameStateEngine();
    const randomSpy = jest.spyOn(PikaLocal, "getRandomBerry").mockResolvedValue(buildBerry());

    const awarded = await awardCatchBerries(engine);

    expect(randomSpy).toHaveBeenCalledTimes(CATCH_BERRY_COUNT);
    expect(engine.current.bag).toEqual(awarded);
  });

  it("shares the bag with held-item rewards rather than replacing them", async () => {
    const engine = new GameStateEngine();
    engine.addItem({ id: 234, type: "Hold items", description: "", name: { english: "Leftovers" } });
    jest.spyOn(PikaLocal, "getRandomBerry").mockResolvedValue(buildBerry());

    await awardCatchBerries(engine);

    expect(engine.current.bag.map((item) => item.name.english)).toEqual(["Leftovers", "Sitrus Berry"]);
  });
});
