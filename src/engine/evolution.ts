import { PikaLocal } from "../api/pikaLocal";
import type { Pokemon } from "../api/pikaserve";

export interface EvolutionInfo {
  /** Species id this Pokemon evolves into. */
  evolvesInto: number;
  /** Level it evolves at — parsed off a level-based condition, or rolled once for others. */
  evolutionLevel: number;
}

/** Random level for a Pokemon whose evolution family is a single hop (base -> final). */
const ONE_EVOLUTION_RANGE: [number, number] = [25, 35];
/** Random level for the first hop of a two-evolution family (base -> mid). */
const TWO_EVOLUTION_FIRST_RANGE: [number, number] = [17, 23];
/** Random level for the second hop of a two-evolution family (mid -> final). */
const TWO_EVOLUTION_SECOND_RANGE: [number, number] = [36, 43];

const LEVEL_CONDITION = /^Level (\d+)/;

function randomInRange([min, max]: [number, number], random: () => number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/**
 * Resolves what `pokemon` evolves into and at what level, if it evolves at all. Of a Pokemon's
 * possibly-branching `evolution.next` options, only the first is used — this game has no mechanic
 * for stones/trade/friendship/personality to pick a specific branch.
 *
 * A level-based condition (e.g. "Level 16", "Level 20, Female") keeps its listed level. A
 * non-level condition (stones, trade, friendship, ...) instead rolls a level from a range chosen
 * by the Pokemon's position in its evolution family: 25-35 if it's a lone evolution, 17-23 if
 * it's the first of two, 36-43 if it's the second of two (this dataset has no family deeper than
 * three stages, so "has a prev" always means "is the second of two").
 */
export async function resolveEvolution(
  pokemon: Pokemon,
  random: () => number = Math.random,
): Promise<EvolutionInfo | null> {
  const next = pokemon.evolution?.next?.[0];
  if (!next) return null;

  const [targetId, condition] = next;
  const evolvesInto = Number(targetId);

  const levelMatch = LEVEL_CONDITION.exec(condition);
  if (levelMatch) {
    return { evolvesInto, evolutionLevel: Number(levelMatch[1]) };
  }

  if (pokemon.evolution?.prev) {
    return { evolvesInto, evolutionLevel: randomInRange(TWO_EVOLUTION_SECOND_RANGE, random) };
  }

  const target = await PikaLocal.getPokemon(evolvesInto);
  const targetEvolvesFurther = Boolean(target.evolution?.next?.length);
  const range = targetEvolvesFurther ? TWO_EVOLUTION_FIRST_RANGE : ONE_EVOLUTION_RANGE;
  return { evolvesInto, evolutionLevel: randomInRange(range, random) };
}
