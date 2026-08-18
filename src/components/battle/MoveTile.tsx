import type { Move } from "../../api/pikaserve";
import { bulbapediaMoveUrl, pokemonDbMoveUrl } from "../../util/externalLinks";

export interface MoveTileProps {
  move: Move;
  selected?: boolean;
  onClick?: () => void;
}

/** A single move's tile, as used in the battle FIGHT menu — name/PWR/ACC on the left, type/PP/category on the right. */
export function MoveTile({ move, selected = false, onClick }: MoveTileProps) {
  return (
    <div
      role="menuitemradio"
      aria-checked={selected}
      tabIndex={-1}
      onClick={onClick}
      className={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm font-semibold ${
        selected ? "bg-white text-slate-900" : "bg-slate-700 text-slate-200"
      }`}
    >
      <div className="min-w-0">
        <div className="truncate">{move.name.english}</div>
        <div className="text-[10px] font-normal opacity-75">
          PWR {move.power} · ACC {move.accuracy}
        </div>
        <div className="flex gap-2 text-[10px] font-normal opacity-75">
          <a
            href={pokemonDbMoveUrl(move.name.english)}
            target="_blank"
            rel="noopener noreferrer"
            title="PMDB"
            onClick={(event) => event.stopPropagation()}
            className="underline"
          >
            PMDB
          </a>
          <a
            href={bulbapediaMoveUrl(move.name.english)}
            target="_blank"
            rel="noopener noreferrer"
            title="Bulba"
            onClick={(event) => event.stopPropagation()}
            className="underline"
          >
            Bulba
          </a>
        </div>
      </div>
      <div className="shrink-0 text-right text-[10px] font-normal opacity-75">
        <div>{move.type}</div>
        <div>{move.pp} PP</div>
        <div>{move.category}</div>
      </div>
    </div>
  );
}
