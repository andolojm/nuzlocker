import type { Move } from "../../api/pikaserve";
import { getEffectivenessMultiplier } from "../../battle/typeEffectiveness";
import { bulbapediaMoveUrl, pokemonDbMoveUrl } from "../../util/externalLinks";

export interface MoveTileProps {
  move: Move;
  selected?: boolean;
  onClick?: () => void;
  /** When provided, shows an effectiveness indicator (arrows/X) for this move against a defender with these types. */
  defenderTypes?: string[];
}

/** Arrows/X hinting how effective a move is against `defenderTypes` — 2x/4x up, 0.5x/0.25x down, 0x an X. */
function EffectivenessIndicator({ moveType, defenderTypes }: { moveType: string; defenderTypes: string[] }) {
  const multiplier = getEffectivenessMultiplier(moveType, defenderTypes);

  if (multiplier === 0) {
    return (
      <span
        className="rounded-sm bg-white px-0.5 leading-none font-bold text-black"
        title="No effect"
        aria-label="No effect"
      >
        ✕
      </span>
    );
  }
  if (multiplier === 4) {
    return (
      <span className="leading-none font-bold text-green-400" title="Super effective (4x)" aria-label="Super effective (4x)">
        ▲▲
      </span>
    );
  }
  if (multiplier === 2) {
    return (
      <span className="leading-none font-bold text-green-400" title="Super effective (2x)" aria-label="Super effective (2x)">
        ▲
      </span>
    );
  }
  if (multiplier === 0.25) {
    return (
      <span
        className="leading-none font-bold text-red-400"
        title="Not very effective (0.25x)"
        aria-label="Not very effective (0.25x)"
      >
        ▼▼
      </span>
    );
  }
  if (multiplier === 0.5) {
    return (
      <span
        className="leading-none font-bold text-red-400"
        title="Not very effective (0.5x)"
        aria-label="Not very effective (0.5x)"
      >
        ▼
      </span>
    );
  }
  return null;
}

/** A single move's tile, as used in the battle FIGHT menu — name/PWR/ACC on the left, type/PP/category on the right. */
export function MoveTile({ move, selected = false, onClick, defenderTypes }: MoveTileProps) {
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
        <div className="flex items-center justify-end gap-1">
          {defenderTypes && <EffectivenessIndicator moveType={move.type} defenderTypes={defenderTypes} />}
          <span>{move.type}</span>
        </div>
        <div>{move.pp} PP</div>
        <div>{move.category}</div>
      </div>
    </div>
  );
}
