import type { Move } from "./pikaserve";

/**
 * Locally-curated "excluded from random selection" flag for moves, parallel to Ability.hidden but
 * kept out of the vendored moves.json (there's no build step here to regenerate it from), so it's
 * persisted separately instead.
 */
export const HIDDEN_MOVES_STORAGE_KEY = "nuzlocker:hidden-moves";

/** Curated starting set of hidden move ids for anyone with no saved preference yet — moves the
 * battle sim can't model well, or otherwise unwanted at random. */
export const DEFAULT_HIDDEN_MOVE_IDS: readonly string[] = [
  "37",
  "216",
  "221",
  "255",
  "284",
  "323",
  "387",
  "438",
  "449",
  "460",
  "463",
  "517",
  "518",
  "519",
  "520",
  "546",
  "550",
  "551",
  "558",
  "559",
  "586",
  "617",
  "682",
  "690",
  "704",
  "718",
  "720",
  "732",
  "734",
  "738",
  "741",
  "744",
  "780",
  "781",
  "782",
  "783",
  "796",
];

function getStorage(): Storage | undefined {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function readHiddenMoveIds(): Set<string> {
  const storage = getStorage();
  if (!storage) return new Set(DEFAULT_HIDDEN_MOVE_IDS);
  try {
    const raw = storage.getItem(HIDDEN_MOVES_STORAGE_KEY);
    if (!raw) return new Set(DEFAULT_HIDDEN_MOVE_IDS);
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set(DEFAULT_HIDDEN_MOVE_IDS);
  } catch {
    return new Set(DEFAULT_HIDDEN_MOVE_IDS);
  }
}

let hiddenMoveIds = readHiddenMoveIds();

/** Move ids currently excluded from random selection. */
export function getHiddenMoveIds(): Set<string> {
  return new Set(hiddenMoveIds);
}

/** Replaces the full set of hidden move ids and persists it. */
export function setHiddenMoveIds(ids: Iterable<string>): void {
  hiddenMoveIds = new Set(ids);
  getStorage()?.setItem(HIDDEN_MOVES_STORAGE_KEY, JSON.stringify([...hiddenMoveIds]));
}

export function isMoveHidden(move: Pick<Move, "id">): boolean {
  return hiddenMoveIds.has(move.id);
}
