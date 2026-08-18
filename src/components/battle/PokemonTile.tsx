import type { TeamPokemon } from "../../engine/gameStateEngine";
import { HpBar } from "./HpBar";

export interface PokemonTileProps {
  pokemon: TeamPokemon;
  hp?: { current: number; max: number };
  /** True when this tile sits on a light/selected background, so the HP bar label uses dark-on-light colors. */
  emphasized?: boolean;
  /** Set to false to hide the HP bar entirely. Defaults to true. */
  showHp?: boolean;
}

/** Icon + name/level + HP bar content for a Pokemon tile. Not itself a button — callers wrap it in whatever interactive element they need. */
export function PokemonTile({ pokemon, hp, emphasized = false, showHp = true }: PokemonTileProps) {
  return (
    <>
      <img
        src={pokemon.image.sprite}
        alt=""
        className="h-8 w-8 shrink-0 object-contain [image-rendering:pixelated]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-xs font-semibold">{pokemon.name.english}</span>
          <span className="shrink-0 text-[10px]">Lv{pokemon.level}</span>
        </div>
        {showHp && hp && <HpBar current={hp.current} max={hp.max} dark={!emphasized} />}
      </div>
    </>
  );
}
