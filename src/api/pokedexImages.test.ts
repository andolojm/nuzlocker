import pokedexData from "../vendor/pokemon-data/pokedex.json";
import type { RawPokemon } from "./pikaserve";

const pokedex = pokedexData as unknown as RawPokemon[];

/**
 * Upstream's hires art for these is unusable — see the pokedex.json "hires images" note in the
 * vendored data's README. Their hires URL is pointed at the thumbnail instead, which for this
 * range (and only this range) is the full-size transparent official artwork.
 */
const FIRST_GEN8_ID = 810;
const LAST_GEN8_ID = 898;

describe("pokedex image urls", () => {
  it("gives every Pokemon all three images", () => {
    const missing = pokedex.filter(
      (pokemon) => !pokemon.image?.sprite || !pokemon.image?.thumbnail || !pokemon.image?.hires,
    );

    expect(missing.map((pokemon) => pokemon.name.english)).toEqual([]);
  });

  it("keeps the gen 8 hires images pointed at their transparent thumbnail art", () => {
    const gen8 = pokedex.filter((pokemon) => pokemon.id >= FIRST_GEN8_ID && pokemon.id <= LAST_GEN8_ID);
    const notSwapped = gen8.filter((pokemon) => pokemon.image.hires !== pokemon.image.thumbnail);

    expect(gen8).toHaveLength(LAST_GEN8_ID - FIRST_GEN8_ID + 1);
    expect(notSwapped.map((pokemon) => pokemon.name.english)).toEqual([]);
  });

  it("leaves every other Pokemon on its own hires art", () => {
    const rest = pokedex.filter((pokemon) => pokemon.id < FIRST_GEN8_ID || pokemon.id > LAST_GEN8_ID);
    const swapped = rest.filter((pokemon) => pokemon.image.hires === pokemon.image.thumbnail);

    expect(swapped.map((pokemon) => pokemon.name.english)).toEqual([]);
    expect(rest.every((pokemon) => pokemon.image.hires.includes("/hires/"))).toBe(true);
  });
});
