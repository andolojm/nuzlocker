import { useEffect, useState } from "react";
import type { Pokemon } from "../../api/pikaserve";
import type { EvolutionChainEntry, EvolutionInfo } from "../../engine/evolution";
import { resolveEvolutionChain } from "../../engine/evolution";

export interface EvolutionChainProps {
  pokemon: Pokemon;
  /** This Pokemon's own already-resolved evolvesInto/evolutionLevel, if it has one — used for its
   * own step in the chain instead of rolling a fresh one that might not match what actually happens
   * when it evolves. */
  knownNext?: EvolutionInfo;
}

/**
 * The full evolution family `pokemon` belongs to, base stage through final stage, each shown as its
 * sprite, name, and (other than the final stage) the level it evolves at. Renders nothing while
 * loading, and nothing at all for a Pokemon with no evolution family (no prior or further stage).
 */
export function EvolutionChain({ pokemon, knownNext }: EvolutionChainProps) {
  const [chain, setChain] = useState<EvolutionChainEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setChain(null);
    void resolveEvolutionChain(pokemon, knownNext).then((resolved) => {
      if (!cancelled) setChain(resolved);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pokemon.id, knownNext?.evolvesInto, knownNext?.evolutionLevel]);

  if (!chain || chain.length <= 1) return null;

  return (
    <div className="mt-3 border-t border-slate-200 pt-2">
      <h3 className="font-semibold">Evolution Chain</h3>
      <div className="mt-1.5 flex flex-col gap-1.5">
        {chain.map((entry) => (
          <div
            key={entry.pokemon.id}
            className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${
              entry.pokemon.id === pokemon.id ? "border-emerald-500 bg-emerald-50" : "border-slate-200"
            }`}
          >
            <img
              src={entry.pokemon.image.thumbnail}
              alt={entry.pokemon.name.english}
              className="h-10 w-10 shrink-0 object-contain [image-rendering:pixelated]"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{entry.pokemon.name.english}</span>
            {entry.evolutionLevel !== undefined && (
              <span className="shrink-0 text-xs font-normal text-slate-600">
                Evolves at Lv{entry.evolutionLevel}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
