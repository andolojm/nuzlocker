import { Dex } from "@pkmn/sim";
import type { Move } from "../api/pikaserve";

/** Flavor text for a move, sourced from @pkmn/sim's own move data rather than the vendored pokemon-data (which carries no description field). */
export function moveDescription(move: Pick<Move, "name">): string {
  const dexMove = Dex.moves.get(move.name.english);
  return dexMove?.shortDesc || dexMove?.desc || "";
}
