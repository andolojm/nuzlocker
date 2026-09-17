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

export interface EvolutionChainEntry {
  pokemon: Pokemon;
  /** Level this stage evolves into the next one at, or undefined if it's the final stage. */
  evolutionLevel?: number;
}

/**
 * Resolves the full evolution family `pokemon` belongs to, from its base stage through its final
 * stage (inclusive of `pokemon` itself, wherever it falls in that chain).
 *
 * The step out of `pokemon` itself prefers `knownNext` — its own already-resolved evolvesInto/
 * evolutionLevel, when it has one — so the level shown matches what will actually happen when this
 * individual evolves, rather than a fresh (and possibly different) roll. Every other step in the
 * chain is resolved fresh, since no individual has reached those stages yet to have rolled one.
 */
export async function resolveEvolutionChain(
  pokemon: Pokemon,
  knownNext?: EvolutionInfo,
  random: () => number = Math.random,
): Promise<EvolutionChainEntry[]> {
  let base = pokemon;
  while (base.evolution?.prev) {
    base = await PikaLocal.getPokemon(Number(base.evolution.prev[0]));
  }

  const chain: EvolutionChainEntry[] = [];
  let current = base;
  while (true) {
    const evolution = current.id === pokemon.id && knownNext ? knownNext : await resolveEvolution(current, random);

    if (!evolution) {
      chain.push({ pokemon: current });
      return chain;
    }

    chain.push({ pokemon: current, evolutionLevel: evolution.evolutionLevel });
    current = await PikaLocal.getPokemon(evolution.evolvesInto);
  }
}

/**
 * The lowest level `pokemon` could legitimately exist at, per a level-based `evolution.prev`
 * condition — 0 if it has no prior evolution, or its prior evolution isn't level-gated (stone,
 * trade, friendship, ...). Used to keep wild encounters from handing out an already-evolved
 * Pokemon below the level it could only have reached by evolving.
 */
export function minimumLevelFor(pokemon: Pick<Pokemon, "evolution">): number {
  const prev = pokemon.evolution?.prev;
  if (!prev) return 0;

  const match = LEVEL_CONDITION.exec(prev[1]);
  return match ? Number(match[1]) : 0;
}
