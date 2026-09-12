import { PikaLocal } from "../api/pikaLocal";
import type { Move } from "../api/pikaserve";
import { resolveEvolution } from "../engine/evolution";
import type { TeamPokemon } from "../engine/gameStateEngine";

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
  strength: number | undefined,
  level: number,
): Promise<TeamPokemon> {
  const minBst = strength === undefined ? undefined : strength * (1 - STRENGTH_TOLERANCE);
  const maxBst = strength === undefined ? undefined : strength * (1 + STRENGTH_TOLERANCE);
  const avoidDuplicates = caughtPokemon.length < DUPLICATE_REROLL_LIMIT;
  const caughtIds = new Set(caughtPokemon.map((p) => p.id));

  let pokemon;
  do {
    pokemon = await PikaLocal.getRandomPokemon(minBst, maxBst);
  } while (avoidDuplicates && caughtIds.has(pokemon.id));

  const [moves, ability] = await Promise.all([rollMoveset(level), PikaLocal.getRandomAbility()]);
  const evolution = await resolveEvolution(pokemon);

  return { ...pokemon, level, moves, ability: ability.name, ...evolution };
}

/** Rolls 4 random moves, re-rolling the whole set if every one comes back Status (no damaging move). */
async function rollMoveset(level: number): Promise<[Move, Move, Move, Move]> {
  let moves: [Move, Move, Move, Move];
  do {
    moves = await Promise.all([
      PikaLocal.getRandomMove(level),
      PikaLocal.getRandomMove(level),
      PikaLocal.getRandomMove(level),
      PikaLocal.getRandomMove(level),
    ]);
  } while (moves.every((move) => move.category === "Status"));

  return moves;
}
