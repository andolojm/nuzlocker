import type { Pokemon } from "../api/pikaserve";
import { attemptCatch } from "./catchPokemon";

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

describe("attemptCatch", () => {
  it("always catches when the modified catch rate reaches the certain-capture threshold", () => {
    const pokemon = buildPokemon({ catchRate: 255 });
    const random = () => {
      throw new Error("random should not be called on a certain capture");
    };

    const result = attemptCatch(pokemon, { currentHpFraction: 0.01, ballBonus: 2, random });

    expect(result).toEqual({ caught: true, shakes: 4 });
  });

  it("catches when every shake check passes", () => {
    const pokemon = buildPokemon();

    const result = attemptCatch(pokemon, { random: () => 0 });

    expect(result).toEqual({ caught: true, shakes: 4 });
  });

  it("fails on the first shake check when the roll always misses", () => {
    const pokemon = buildPokemon();

    const result = attemptCatch(pokemon, { random: () => 0.99999 });

    expect(result).toEqual({ caught: false, shakes: 0 });
  });

  it("makes a weakened Pokemon easier to catch than a healthy one, for the same roll", () => {
    const pokemon = buildPokemon();
    // Straddles the shake threshold for this Pokemon: below the low-HP threshold (succeeds) but
    // above the full-HP threshold (fails) — see the pinned-formula test below for the exact values.
    const roll = () => 50000 / 65536;

    const atFullHealth = attemptCatch(pokemon, { currentHpFraction: 1, random: roll });
    const atLowHealth = attemptCatch(pokemon, { currentHpFraction: 0.1, random: roll });

    expect(atFullHealth).toEqual({ caught: false, shakes: 0 });
    expect(atLowHealth).toEqual({ caught: true, shakes: 4 });
  });

  it("uses the Gen III+ shake formula (regression guard for the shake-threshold constant)", () => {
    // catchRate 120, full HP, neutral ball/status -> modifiedCatchRate 40 -> shake threshold 41942.
    // (Using SHAKE_ROLL_MAX as the threshold numerator instead of the correct 1048560 constant
    // previously made every shake ~16x less likely to succeed than the real games.)
    const pokemon = buildPokemon({ catchRate: 120 });

    const justBelowThreshold = attemptCatch(pokemon, { random: () => 41941 / 65536 });
    const justAtThreshold = attemptCatch(pokemon, { random: () => 41942 / 65536 });

    expect(justBelowThreshold).toEqual({ caught: true, shakes: 4 });
    expect(justAtThreshold).toEqual({ caught: false, shakes: 0 });
  });

  it("defaults to full HP, a neutral ball, and no status bonus", () => {
    const pokemon = buildPokemon();

    const withDefaults = attemptCatch(pokemon, { random: () => 0.5 });
    const explicit = attemptCatch(pokemon, {
      currentHpFraction: 1,
      ballBonus: 1,
      statusBonus: 1,
      random: () => 0.5,
    });

    expect(withDefaults).toEqual(explicit);
  });
});
