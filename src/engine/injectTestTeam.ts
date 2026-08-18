import { PikaLocal } from "../api/pikaLocal";
import { resolveEvolution } from "./evolution";
import { GameStateEngine, gameStateEngine } from "./gameStateEngine";
import type { TeamPokemon } from "./gameStateEngine";

export const TEST_TEAM_SIZE = 10;
export const TEST_TEAM_LEVEL = 50;
export const TEST_TEAM_ACTIVE_SIZE = 6;

async function buildRandomTeamPokemon(): Promise<TeamPokemon> {
  const [pokemon, move1, move2, move3, move4] = await Promise.all([
    PikaLocal.getRandomPokemon(),
    PikaLocal.getRandomMove(),
    PikaLocal.getRandomMove(),
    PikaLocal.getRandomMove(),
    PikaLocal.getRandomMove(),
  ]);

  const evolution = await resolveEvolution(pokemon);

  // TeamPokemon has no IV/EV/nature fields to set — battleSimulator.ts already treats every
  // team member as flawless IVs / 0 EVs / neutral nature when converting to a Showdown team.
  return { ...pokemon, level: TEST_TEAM_LEVEL, moves: [move1, move2, move3, move4], ...evolution };
}

/** Deletes any existing Pokemon, then adds 10 random level-50 Pokemon to the alive party and sets the first 6 as the active team. */
export async function injectTestTeam(engine: GameStateEngine = gameStateEngine): Promise<void> {
  const team = await Promise.all(Array.from({ length: TEST_TEAM_SIZE }, buildRandomTeamPokemon));

  engine.clearPokemon();
  for (const pokemon of team) {
    engine.addPokemon(pokemon);
  }

  const newlyAdded = engine.current.pokemon.alive.slice(-TEST_TEAM_SIZE);
  engine.setActiveTeam(newlyAdded.slice(0, TEST_TEAM_ACTIVE_SIZE));
}
