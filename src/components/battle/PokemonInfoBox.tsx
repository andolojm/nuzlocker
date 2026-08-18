import type { TeamPokemon } from "../../engine/gameStateEngine";
import { bulbapediaPokemonUrl, pokemonDbPokemonUrl } from "../../util/externalLinks";
import { HpBar } from "./HpBar";

export interface PokemonInfoBoxProps {
  pokemon: TeamPokemon;
  hp: { current: number; max: number };
  /** Renders an "INFO" link that opens the PokemonInfoModal. Omit to hide it. */
  onInfoClick?: () => void;
}

export function PokemonInfoBox({ pokemon, hp, onInfoClick }: PokemonInfoBoxProps) {
  return (
    <div className="w-56 rounded-lg border-2 border-slate-700 bg-slate-100 px-3 py-2 shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-900 min-[600px]:text-base">{pokemon.name.english}</span>
        <span className="text-xs font-semibold text-slate-700 min-[600px]:text-sm">Lv{pokemon.level}</span>
      </div>
      <div className="mt-1.5">
        <HpBar current={hp.current} max={hp.max} />
      </div>
      <div className="mt-1 flex gap-2 text-[10px] text-slate-600 min-[600px]:text-xs">
        <a
          href={pokemonDbPokemonUrl(pokemon.name.english)}
          target="_blank"
          rel="noopener noreferrer"
          title="PMDB"
          className="underline"
        >
          PMDB
        </a>
        <a
          href={bulbapediaPokemonUrl(pokemon.name.english)}
          target="_blank"
          rel="noopener noreferrer"
          title="Bulba"
          className="underline"
        >
          Bulba
        </a>
        {onInfoClick && (
          <button type="button" onClick={onInfoClick} className="underline">
            INFO
          </button>
        )}
      </div>
    </div>
  );
}
