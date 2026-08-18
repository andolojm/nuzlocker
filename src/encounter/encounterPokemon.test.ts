import { PikaLocal } from "../api/pikaLocal";
import type { Move, Pokemon } from "../api/pikaserve";
import type { TeamPokemon } from "../engine/gameStateEngine";
import { TEST_TEAM_LEVEL } from "../engine/injectTestTeam";
import { encounterPokemon } from "./encounterPokemon";

function buildMove(overrides: Partial<Move> = {}): Move {
  return {
    id: "33",
    name: { english: "Tackle" },
    type: "Normal",
    category: "Physical",
    pp: "35",
    power: "40",
    accuracy: "100%",
    ...overrides,
  };
}

function buildPokemon(overrides: Partial<Pokemon> = {}): Pokemon {
  return {
    id: 25,
    name: { english: "Pikachu" },
    type: ["Electric"],
    base: { HP: 35, Attack: 55, Defense: 40, "Sp. Attack": 50, "Sp. Defense": 50, Speed: 90 },
    species: "Mouse Pokémon",
    bst: 320,
    description: "Pikachu.",
    profile: {
      height: "0.4 m",
      weight: "6 kg",
      egg: ["Field", "Fairy"],
      ability: [["Static", "false"]],
      gender: "50:50",
    },
    image: {
      sprite: "https://example.com/sprite.png",
      thumbnail: "https://example.com/thumb.png",
      hires: "https://example.com/hires.png",
    },
    catchRate: 120,
    ivs: { HP: 31, Attack: 31, Defense: 31, "Sp. Attack": 31, "Sp. Defense": 31, Speed: 31 },
    ...overrides,
  };
}

function buildTeamPokemon(overrides: Partial<Pokemon> = {}): TeamPokemon {
  return {
    ...buildPokemon(overrides),
    moves: [buildMove(), buildMove(), buildMove(), buildMove()],
    level: 5,
  };
}

describe("encounterPokemon", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("resolves with a TeamPokemon built from PikaLocal's random pokemon and moves", async () => {
    const pikachu = buildPokemon();
    const moves = [buildMove({ id: "1" }), buildMove({ id: "2" }), buildMove({ id: "3" }), buildMove({ id: "4" })];
    jest.spyOn(PikaLocal, "getRandomPokemon").mockResolvedValue(pikachu);
    jest
      .spyOn(PikaLocal, "getRandomMove")
      .mockResolvedValueOnce(moves[0])
      .mockResolvedValueOnce(moves[1])
      .mockResolvedValueOnce(moves[2])
      .mockResolvedValueOnce(moves[3]);

    const result = await encounterPokemon(1, []);

    expect(result).toEqual({ ...pikachu, level: TEST_TEAM_LEVEL, moves });
  });

  it("sets the level to TEST_TEAM_LEVEL", async () => {
    jest.spyOn(PikaLocal, "getRandomPokemon").mockResolvedValue(buildPokemon());
    jest.spyOn(PikaLocal, "getRandomMove").mockResolvedValue(buildMove());

    const result = await encounterPokemon(1, []);

    expect(result.level).toBe(TEST_TEAM_LEVEL);
  });

  it("gives the pokemon 4 moves", async () => {
    jest.spyOn(PikaLocal, "getRandomPokemon").mockResolvedValue(buildPokemon());
    const spy = jest.spyOn(PikaLocal, "getRandomMove").mockResolvedValue(buildMove());

    const result = await encounterPokemon(1, []);

    expect(result.moves).toHaveLength(4);
    expect(spy).toHaveBeenCalledTimes(4);
  });

  it("ignores the stage argument", async () => {
    const bulbasaur = buildPokemon({ id: 1, name: { english: "Bulbasaur" } });
    const pokemonSpy = jest.spyOn(PikaLocal, "getRandomPokemon").mockResolvedValue(bulbasaur);
    jest.spyOn(PikaLocal, "getRandomMove").mockResolvedValue(buildMove());

    const withStage1 = await encounterPokemon(1, []);
    const withStage42 = await encounterPokemon(42, []);

    expect(withStage1.name.english).toBe("Bulbasaur");
    expect(withStage42.name.english).toBe("Bulbasaur");
    expect(pokemonSpy).toHaveBeenCalledTimes(2);
  });

  it("without a strength argument, requests an unbounded bst range", async () => {
    const pokemonSpy = jest.spyOn(PikaLocal, "getRandomPokemon").mockResolvedValue(buildPokemon());
    jest.spyOn(PikaLocal, "getRandomMove").mockResolvedValue(buildMove());

    await encounterPokemon(1, []);

    expect(pokemonSpy).toHaveBeenCalledWith(undefined, undefined);
  });

  it("with a strength argument, requests pokemon within 10% of it on either side", async () => {
    const pokemonSpy = jest.spyOn(PikaLocal, "getRandomPokemon").mockResolvedValue(buildPokemon());
    jest.spyOn(PikaLocal, "getRandomMove").mockResolvedValue(buildMove());

    await encounterPokemon(1, [], 450);

    const [minBst, maxBst] = pokemonSpy.mock.calls[0];
    expect(minBst).toBeCloseTo(405);
    expect(maxBst).toBeCloseTo(495);
  });

  it("re-rolls when the encountered pokemon is already in caughtPokemon", async () => {
    const bulbasaur = buildPokemon({ id: 1, name: { english: "Bulbasaur" } });
    const charmander = buildPokemon({ id: 4, name: { english: "Charmander" } });
    const pokemonSpy = jest
      .spyOn(PikaLocal, "getRandomPokemon")
      .mockResolvedValueOnce(bulbasaur)
      .mockResolvedValueOnce(bulbasaur)
      .mockResolvedValueOnce(charmander);
    jest.spyOn(PikaLocal, "getRandomMove").mockResolvedValue(buildMove());

    const result = await encounterPokemon(1, [buildTeamPokemon({ id: 1, name: { english: "Bulbasaur" } })]);

    expect(result.name.english).toBe("Charmander");
    expect(pokemonSpy).toHaveBeenCalledTimes(3);
  });

  it("stops re-rolling duplicates once caughtPokemon has 500 or more entries", async () => {
    const bulbasaur = buildPokemon({ id: 1, name: { english: "Bulbasaur" } });
    const pokemonSpy = jest.spyOn(PikaLocal, "getRandomPokemon").mockResolvedValue(bulbasaur);
    jest.spyOn(PikaLocal, "getRandomMove").mockResolvedValue(buildMove());
    const caughtPokemon = Array.from({ length: 500 }, (_, i) =>
      buildTeamPokemon({ id: i === 0 ? 1 : i + 1000, name: { english: `Mon${i}` } }),
    );

    const result = await encounterPokemon(1, caughtPokemon);

    expect(result.name.english).toBe("Bulbasaur");
    expect(pokemonSpy).toHaveBeenCalledTimes(1);
  });
});
