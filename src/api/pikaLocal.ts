/**
 * In-process vendored port of PikaServe (github.com/Purukitto/PikaServe), which is itself a thin
 * lookup layer over pokemon-data.json. Rather than running PikaServe as a separate HTTP server and
 * fetching from it, this module ports its route logic directly over the vendored data files in
 * src/vendor/pokemon-data, so the same lookups are plain function calls with no network hop.
 *
 * Lookup semantics (case-insensitive name match with whitespace stripped, or numeric id match, or
 * "all"/"random") are copied from PikaServe's route handlers to preserve behavior.
 */
import pokedexData from "../vendor/pokemon-data/pokedex.json";
import movesData from "../vendor/pokemon-data/moves.json";
import itemsData from "../vendor/pokemon-data/items.json";
import typesData from "../vendor/pokemon-data/types.json";
import type {
  Item,
  Move,
  NameOrId,
  Pokemon,
  PokemonType,
  RawPokemon,
  TM,
} from "./pikaserve";
import { enrichPokemon } from "./pikaserve";

const pokedex = pokedexData as unknown as RawPokemon[];
const moves = movesData as unknown as Move[];
const items = itemsData as unknown as Item[];
const types = typesData as unknown as PokemonType[];

// Sorted once at module load (dex order on disk is left alone for readability/diffability) so bst
// range queries are a binary search + slice instead of an O(n) filter. At 898 entries a plain filter
// would already be sub-millisecond, so this isn't about raw speed — it's a cheap way to make
// getRandomPokemon's range lookup and pool size O(log n) instead of O(n) if the dex ever grows.
const pokedexByBst = [...pokedex].sort((a, b) => a.bst - b.bst);

/** Index of the first entry with bst >= min. */
function lowerBoundBst(min: number): number {
  let lo = 0;
  let hi = pokedexByBst.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (pokedexByBst[mid].bst < min) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Index one past the last entry with bst <= max. */
function upperBoundBst(max: number): number {
  let lo = 0;
  let hi = pokedexByBst.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (pokedexByBst[mid].bst <= max) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function pokedexInBstRange(minBst?: number, maxBst?: number): RawPokemon[] {
  if (minBst === undefined && maxBst === undefined) return pokedex;
  const lo = minBst === undefined ? 0 : lowerBoundBst(minBst);
  const hi = maxBst === undefined ? pokedexByBst.length : upperBoundBst(maxBst);
  return pokedexByBst.slice(lo, hi);
}

function normalize(nameOrId: NameOrId): string {
  return String(nameOrId).toLowerCase().replace(/\s/g, "");
}

/** Not found is a bug in real PikaServe (returns 200 + a message body instead of 404) — preserved here as a thrown error instead, since callers no longer parse HTTP responses. */
export class PikaLocalNotFoundError extends Error {
  constructor(kind: string, nameOrId: NameOrId) {
    super(`${kind} not found: ${nameOrId}`);
    this.name = "PikaLocalNotFoundError";
  }
}

function findByIdOrName<T>(
  list: T[],
  nameOrId: NameOrId,
  getId: (item: T) => number | string,
  getName: (item: T) => string | undefined,
  kind: string,
): T {
  const normalized = normalize(nameOrId);
  const asNumber = Number(normalized);

  if (!Number.isNaN(asNumber) && normalized !== "") {
    const byId = list.find((item) => String(getId(item)) === String(asNumber));
    if (byId) return byId;
    throw new PikaLocalNotFoundError(kind, nameOrId);
  }

  const byName = list.find((item) => {
    const name = getName(item);
    return name !== undefined && normalize(name) === normalized;
  });
  if (byName) return byName;
  throw new PikaLocalNotFoundError(kind, nameOrId);
}

function pickRandom<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Vendored PikaServe: same public surface as PikaServe (src/api/pikaserve.ts), but every method
 * resolves synchronously-computed data wrapped in a resolved Promise, so callers written against the
 * async HTTP client work unchanged.
 */
export class PikaLocal {
  static async getAllPokemon(): Promise<Pokemon[]> {
    return pokedex.map(enrichPokemon);
  }

  /** minBst/maxBst are both inclusive; omit either to leave that side of the range unbounded. */
  static async getRandomPokemon(minBst?: number, maxBst?: number): Promise<Pokemon> {
    const pool = pokedexInBstRange(minBst, maxBst);
    if (pool.length === 0) {
      throw new PikaLocalNotFoundError("Pokemon", `bst range ${minBst ?? "-inf"}-${maxBst ?? "+inf"}`);
    }
    return enrichPokemon(pickRandom(pool));
  }

  static async getPokemon(nameOrId: NameOrId): Promise<Pokemon> {
    const raw = findByIdOrName(pokedex, nameOrId, (p) => p.id, (p) => p.name.english, "Pokemon");
    return enrichPokemon(raw);
  }

  static async getAllMoves(): Promise<Move[]> {
    return moves;
  }

  static async getRandomMove(): Promise<Move> {
    return pickRandom(moves);
  }

  static async getMove(nameOrId: NameOrId): Promise<Move> {
    // Real PikaServe's /moves/:name route has a bug: it matches on a nonexistent `ename` field, so
    // name-based lookup always fails upstream. This vendored version matches on name.english instead
    // (id-based lookup is unaffected and worked upstream too).
    return findByIdOrName(moves, nameOrId, (m) => m.id, (m) => m.name.english, "Move");
  }

  static async getAllItems(): Promise<Item[]> {
    return items;
  }

  static async getRandomItem(): Promise<Item> {
    return pickRandom(items);
  }

  static async getItem(nameOrId: NameOrId): Promise<Item> {
    return findByIdOrName(items, nameOrId, (i) => i.id, (i) => i.name.english, "Item");
  }

  /** Every move is its own TM, one-to-one — the TM's id is just the move's own id as a number. */
  static async getAllTMs(): Promise<TM[]> {
    return moves.map((move) => ({ id: Number(move.id), move }));
  }

  static async getRandomTM(random: () => number = Math.random): Promise<TM> {
    const tms = await PikaLocal.getAllTMs();
    return tms[Math.floor(random() * tms.length)];
  }

  static async getTM(id: number): Promise<TM> {
    const tms = await PikaLocal.getAllTMs();
    const tm = tms.find((candidate) => candidate.id === id);
    if (!tm) throw new PikaLocalNotFoundError("TM", id);
    return tm;
  }

  static async getAllTypes(): Promise<PokemonType[]> {
    return types;
  }

  static async getRandomType(): Promise<PokemonType> {
    return pickRandom(types);
  }

  static async getType(nameOrId: NameOrId): Promise<PokemonType> {
    // types.json entries have no id field — PikaServe's /types/:id route matches by 1-based array
    // position instead, so that's preserved here rather than reusing findByIdOrName's id matching.
    const normalized = normalize(nameOrId);
    const asNumber = Number(normalized);
    if (!Number.isNaN(asNumber) && normalized !== "") {
      const type = types[asNumber - 1];
      if (type) return type;
      throw new PikaLocalNotFoundError("Type", nameOrId);
    }

    const byName = types.find((t) => normalize(t.english) === normalized);
    if (byName) return byName;
    throw new PikaLocalNotFoundError("Type", nameOrId);
  }
}
