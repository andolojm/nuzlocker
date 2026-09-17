import { useEffect, useState } from "react";
import { PikaLocal } from "../../api/pikaLocal";
import type { Pokemon } from "../../api/pikaserve";

export interface EvolutionLineProps {
  /** Species id this Pokemon evolves into. */
  evolvesInto: number;
  /** Level `evolvesInto` kicks in at. */
  evolutionLevel?: number;
}

/**
 * One-line evolution readout for the Pokemon modals: "Evolves into <name> at level <n>". Evolution
 * is Pokedex-level knowledge rather than something specific to an individual (unlike ability/moves),
 * so this is shown the same way for the player's own Pokemon and for opponents.
 */
export function EvolutionLine({ evolvesInto, evolutionLevel }: EvolutionLineProps) {
  const [target, setTarget] = useState<Pokemon | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTarget(null);
    void PikaLocal.getPokemon(evolvesInto).then((species) => {
      if (!cancelled) setTarget(species);
    });
    return () => {
      cancelled = true;
    };
  }, [evolvesInto]);

  return (
    <p className="text-xs min-[600px]:text-sm">
      <span className="font-semibold">Evolution:</span>{" "}
      {target ? (
        <>
          Evolves into <span className="font-bold">{target.name.english}</span>
          {evolutionLevel !== undefined && ` at level ${evolutionLevel}`}
        </>
      ) : (
        <span className="italic text-slate-600">Loading…</span>
      )}
    </p>
  );
}
