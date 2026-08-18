/**
 * @jest-environment jsdom
 */
import { PikaLocal } from "../api/pikaLocal";
import type { Move, Pokemon } from "../api/pikaserve";
import { GameStateEngine } from "./gameStateEngine";
import type { TeamPokemon } from "./gameStateEngine";
import { TEST_TEAM_ACTIVE_SIZE, TEST_TEAM_LEVEL, TEST_TEAM_SIZE, injectTestTeam } from "./injectTestTeam";

function buildPokemon(overrides: Partial<Pokemon> = {}): Pokemon {
  return {
    id: 1,
    name: { english: "TestMon" },
    type: ["Normal"],
    base: { HP: 50, Attack: 50, Defense: 50, "Sp. Attack": 50, "Sp. Defense": 50, Speed: 50 },
    species: "Test Pokémon",
    bst: 300,
    description: "A test Pokémon.",
    profile: {
      height: "1 m",
      weight: "1 kg",
      egg: ["Field"],
      ability: [["Test", "false"]],
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

function buildMove(overrides: Partial<Move> = {}): Move {
  return {
    id: "1",
    name: { english: "Tackle" },
    type: "Normal",
    category: "Physical",
    pp: "35",
    power: "40",
    accuracy: "100%",
    ...overrides,
  };
}

function buildTeamPokemon(overrides: Partial<Pokemon> = {}): TeamPokemon {
  return { ...buildPokemon(overrides), moves: [buildMove(), buildMove(), buildMove(), buildMove()], level: 5 };
}

describe("injectTestTeam", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it("injects 10 level-50 pokemon with 4 moves each into the alive party", async () => {
    jest.spyOn(PikaLocal, "getRandomPokemon").mockResolvedValue(buildPokemon());
    jest.spyOn(PikaLocal, "getRandomMove").mockResolvedValue(buildMove());

    const engine = new GameStateEngine();
    await injectTestTeam(engine);

    expect(engine.current.pokemon.alive).toHaveLength(TEST_TEAM_SIZE);
    for (const pokemon of engine.current.pokemon.alive) {
      expect(pokemon.level).toBe(TEST_TEAM_LEVEL);
      expect(pokemon.moves).toHaveLength(4);
    }
  });

  it("places the first 6 injected pokemon as the active team, in order", async () => {
    jest.spyOn(PikaLocal, "getRandomPokemon").mockResolvedValue(buildPokemon());
    jest.spyOn(PikaLocal, "getRandomMove").mockResolvedValue(buildMove());

    const engine = new GameStateEngine();
    await injectTestTeam(engine);

    const alive = engine.current.pokemon.alive;
    expect(alive.slice(0, TEST_TEAM_ACTIVE_SIZE).map((pokemon) => pokemon.active)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(alive.slice(TEST_TEAM_ACTIVE_SIZE).every((pokemon) => pokemon.active === undefined)).toBe(true);
  });

  it("deletes any pre-existing pokemon, alive or dead, before injecting the new team", async () => {
    jest.spyOn(PikaLocal, "getRandomPokemon").mockResolvedValue(buildPokemon());
    jest.spyOn(PikaLocal, "getRandomMove").mockResolvedValue(buildMove());

    const engine = new GameStateEngine();
    const preExisting = buildTeamPokemon({ name: { english: "PreExisting" } });
    engine.addPokemon(preExisting, 1);
    engine.markPokemonDead(engine.current.pokemon.alive[0]);

    await injectTestTeam(engine);

    expect(engine.current.pokemon.alive.some((pokemon) => pokemon.name.english === "PreExisting")).toBe(false);
    expect(engine.current.pokemon.dead).toHaveLength(0);
    expect(engine.current.pokemon.alive).toHaveLength(TEST_TEAM_SIZE);
  });
});
