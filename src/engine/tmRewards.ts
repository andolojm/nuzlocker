import { PikaLocal } from "../api/pikaLocal";
import type { Move, TM } from "../api/pikaserve";
import { gameStateEngine } from "./gameStateEngine";
import type { GameStateEngine, OwnedTM } from "./gameStateEngine";

export const VICTORY_TM_COUNT = 2;
export const CATCH_TM_COUNT = 1;

/** Loosely matches move names across old/new formatting drift (e.g. "BubbleBeam" vs "Bubble Beam", "Selfdestruct" vs "Self-Destruct"). */
function normalizeMoveName(name: string): string {
  return name.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

/**
 * A TM's description can list several game-dependent alternative moves for the same TM number
 * (PikaServe merges generations); real TMs teach exactly one, so this just commits to the first.
 * Matched with punctuation/spacing normalized, since some of PikaServe's older move-name spellings
 * (e.g. "BubbleBeam") don't exactly match moves.json's modern formatting ("Bubble Beam").
 */
export function resolveTM(tm: TM, allMoves: Move[]): OwnedTM {
  const moveName = tm.moveNames[0];
  const normalized = normalizeMoveName(moveName);
  const move = allMoves.find((candidate) => normalizeMoveName(candidate.name.english) === normalized);
  if (!move) {
    throw new Error(`Could not resolve move "${moveName}" for TM "${tm.name.english}"`);
  }
  return { id: tm.id, name: tm.name, move };
}

async function awardTMs(count: number, engine: GameStateEngine): Promise<OwnedTM[]> {
  const [rawTMs, allMoves] = await Promise.all([
    Promise.all(Array.from({ length: count }, () => PikaLocal.getRandomTM())),
    PikaLocal.getAllMoves(),
  ]);

  const tms = rawTMs.map((tm) => resolveTM(tm, allMoves));
  for (const tm of tms) engine.addTM(tm);
  return tms;
}

/** Awards VICTORY_TM_COUNT random TMs for winning a battle. */
export function awardVictoryTMs(engine: GameStateEngine = gameStateEngine): Promise<OwnedTM[]> {
  return awardTMs(VICTORY_TM_COUNT, engine);
}

/** Awards CATCH_TM_COUNT random TM(s) for successfully catching a wild Pokemon. */
export function awardCatchTM(engine: GameStateEngine = gameStateEngine): Promise<OwnedTM[]> {
  return awardTMs(CATCH_TM_COUNT, engine);
}
