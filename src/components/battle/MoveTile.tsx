import type { Move } from "../../api/pikaserve";
import { getEffectivenessMultiplier } from "../../battle/typeEffectiveness";
import { bulbapediaMoveUrl, pokemonDbMoveUrl } from "../../util/externalLinks";
import { TYPE_COLORS, typeTintOnWhite } from "./TypeChip";

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

/** A single move's tile, as used in the battle FIGHT menu — name/PWR/ACC on the left, PP/category/type chip on the right. */
export function MoveTile({ move, selected = false, onClick, defenderTypes }: MoveTileProps) {
  const isStatus = move.category === "Status";

  return (
    <div
      role="menuitemradio"
      aria-checked={selected}
      tabIndex={-1}
      onClick={onClick}
      style={isStatus ? undefined : { backgroundColor: typeTintOnWhite(move.type, 0.55) }}
      className={`flex cursor-pointer items-center justify-between gap-2 rounded-md border-2 border-black bg-white px-2 pt-1 pb-2 text-left text-sm font-semibold text-slate-900 ${
        selected ? "ring-2 ring-offset-1 ring-blue-500" : ""
      }`}
    >
      <div className="min-w-0 leading-tight">
        <div className="truncate max-[600px]:text-[11px]">{move.name.english}</div>
        <div className="text-[10px] font-normal opacity-75">
          PWR {move.power} · ACC {move.accuracy}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[10px] font-normal">
          <a
            href={pokemonDbMoveUrl(move.name.english)}
            target="_blank"
            rel="noopener noreferrer"
            title="PMDB"
            onClick={(event) => event.stopPropagation()}
            className="rounded px-1 py-0.5 font-bold text-black"
          >
            PMDB
          </a>
          <a
            href={bulbapediaMoveUrl(move.name.english)}
            target="_blank"
            rel="noopener noreferrer"
            title="Bulba"
            onClick={(event) => event.stopPropagation()}
            className="rounded px-1 py-0.5 font-bold text-black"
          >
            Bulba
          </a>
          {defenderTypes && !isStatus && (
            <EffectivenessIndicator moveType={move.type} defenderTypes={defenderTypes} />
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end text-[10px] leading-snug font-normal opacity-75">
        <div>{move.pp} PP</div>
        <div>{move.category}</div>
        <span
          className={`mt-1 rounded px-1 py-0.5 text-[8px] font-bold text-white ${TYPE_COLORS[move.type] ?? "bg-slate-400"}`}
        >
          {move.type.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
