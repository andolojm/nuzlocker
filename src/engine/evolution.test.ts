import { PikaLocal } from "../api/pikaLocal";
import type { Pokemon, PokemonEvolution } from "../api/pikaserve";
import { resolveEvolution } from "./evolution";

function buildPokemon(id: number, name: string, evolution?: PokemonEvolution): Pokemon {
  return {
    id,
    name: { english: name },
    type: ["Normal"],
    base: { HP: 45, Attack: 49, Defense: 49, "Sp. Attack": 65, "Sp. Defense": 65, Speed: 45 },
    species: "Test Pokémon",
    bst: 318,
    description: "A test Pokémon.",
    evolution,
    profile: { height: "0.7 m", weight: "6.9 kg", egg: ["Field"], ability: [["Overgrow", "false"]], gender: "50:50" },
    image: {
      sprite: "https://example.com/sprite.png",
      thumbnail: "https://example.com/thumb.png",
      hires: "https://example.com/hires.png",
    },
    catchRate: 45,
    ivs: { HP: 31, Attack: 31, Defense: 31, "Sp. Attack": 31, "Sp. Defense": 31, Speed: 31 },
  };
}

const zero = () => 0;
const almostOne = () => 0.999999;

describe("resolveEvolution", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns null when the pokemon has no further evolution", async () => {
    const pokemon = buildPokemon(3, "Venusaur", { prev: ["2", "Level 32"] });

    expect(await resolveEvolution(pokemon)).toBeNull();
  });

  it("returns null when the pokemon has no evolution field at all", async () => {
    const pokemon = buildPokemon(1, "Bulbasaur");

    expect(await resolveEvolution(pokemon)).toBeNull();
  });

  it("keeps the listed level for a plain level-based condition", async () => {
    const pokemon = buildPokemon(1, "Bulbasaur", { next: [["2", "Level 16"]] });

    expect(await resolveEvolution(pokemon)).toEqual({ evolvesInto: 2, evolutionLevel: 16 });
  });

  it("keeps the listed level even with a trailing qualifier", async () => {
    const pokemon = buildPokemon(415, "Combee", { next: [["416", "Level 21, Female"]] });

    expect(await resolveEvolution(pokemon)).toEqual({ evolvesInto: 416, evolutionLevel: 21 });
  });

  it("only ever looks at the first next entry, ignoring other branches", async () => {
    const pokemon = buildPokemon(133, "Eevee", {
      next: [
        ["134", "Level 25"],
        ["135", "use Thunder Stone"],
      ],
    });

    expect(await resolveEvolution(pokemon)).toEqual({ evolvesInto: 134, evolutionLevel: 25 });
  });

  it("rolls within 25-35 for a lone (one-evolution) non-level evolver", async () => {
    const pokemon = buildPokemon(95, "Onix", { next: [["208", "trade holding Metal Coat"]] });
    jest.spyOn(PikaLocal, "getPokemon").mockResolvedValue(buildPokemon(208, "Steelix", { prev: ["95", "trade..."] }));

    expect(await resolveEvolution(pokemon, zero)).toEqual({ evolvesInto: 208, evolutionLevel: 25 });
    expect(await resolveEvolution(pokemon, almostOne)).toEqual({ evolvesInto: 208, evolutionLevel: 35 });
  });

  it("rolls within 17-23 for the first hop of a two-evolution non-level chain", async () => {
    const pokemon = buildPokemon(172, "Pichu", { next: [["25", "high Friendship"]] });
    jest.spyOn(PikaLocal, "getPokemon").mockResolvedValue(
      buildPokemon(25, "Pikachu", { prev: ["172", "high Friendship"], next: [["26", "use Thunder Stone"]] }),
    );

    expect(await resolveEvolution(pokemon, zero)).toEqual({ evolvesInto: 25, evolutionLevel: 17 });
    expect(await resolveEvolution(pokemon, almostOne)).toEqual({ evolvesInto: 25, evolutionLevel: 23 });
  });

  it("rolls within 36-43 for the second hop of a two-evolution non-level chain, without needing a lookup", async () => {
    const pokemon = buildPokemon(25, "Pikachu", {
      prev: ["172", "high Friendship"],
      next: [["26", "use Thunder Stone"]],
    });
    const pokemonSpy = jest.spyOn(PikaLocal, "getPokemon");

    expect(await resolveEvolution(pokemon, zero)).toEqual({ evolvesInto: 26, evolutionLevel: 36 });
    expect(await resolveEvolution(pokemon, almostOne)).toEqual({ evolvesInto: 26, evolutionLevel: 43 });
    expect(pokemonSpy).not.toHaveBeenCalled();
  });
});
