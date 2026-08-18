import { PikaLocal } from "../api/pikaLocal";
import type { TeamPokemon } from "../engine/gameStateEngine";
import { TEST_TEAM_LEVEL } from "../engine/injectTestTeam";

/** "Near" the requested strength means within this fraction of it, on either side. */
const STRENGTH_TOLERANCE = 0.1;

/**
 * Above this many caught Pokemon, stop re-rolling encounters that duplicate an already-caught
 * species — a stand-in until party/box size is actually capped and this becomes a real limit.
 */
const DUPLICATE_REROLL_LIMIT = 500;

export async function encounterPokemon(
  _stage: number,
  caughtPokemon: TeamPokemon[],
  strength?: number,
): Promise<TeamPokemon> {
  const minBst = strength === undefined ? undefined : strength * (1 - STRENGTH_TOLERANCE);
  const maxBst = strength === undefined ? undefined : strength * (1 + STRENGTH_TOLERANCE);
  const avoidDuplicates = caughtPokemon.length < DUPLICATE_REROLL_LIMIT;
  const caughtIds = new Set(caughtPokemon.map((p) => p.id));

  let pokemon;
  do {
    pokemon = await PikaLocal.getRandomPokemon(minBst, maxBst);
  } while (avoidDuplicates && caughtIds.has(pokemon.id));

  const [move1, move2, move3, move4] = await Promise.all([
    PikaLocal.getRandomMove(),
    PikaLocal.getRandomMove(),
    PikaLocal.getRandomMove(),
    PikaLocal.getRandomMove(),
  ]);

  return { ...pokemon, level: TEST_TEAM_LEVEL, moves: [move1, move2, move3, move4] };
}
