import type { Move } from "../../api/pikaserve";
import type { FourMoves } from "../../engine/gameStateEngine";
import { bulbapediaMoveUrl, pokemonDbMoveUrl } from "../../util/externalLinks";
import { useGridSelection } from "./useGridSelection";

export interface MoveSelectMenuProps {
  moves: FourMoves;
  onSelectMove?: (move: Move) => void;
  onClose: () => void;
}

export function MoveSelectMenu({ moves, onSelectMove, onClose }: MoveSelectMenuProps) {
  const { selected, setSelected } = useGridSelection({
    itemCount: moves.length,
    columns: 2,
    isDisabled: () => false,
    onActivate: (index) => onSelectMove?.(moves[index]),
    onClose,
  });

  return (
    <div role="menu" aria-label="Moves" className="grid h-full w-full grid-cols-2 grid-rows-2 gap-1.5">
      {moves.map((move, index) => (
        <div
          key={`${move.id}-${index}`}
          role="menuitemradio"
          aria-checked={index === selected}
          tabIndex={-1}
          onClick={() => {
            setSelected(index);
            onSelectMove?.(move);
          }}
          className={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm font-semibold ${
            index === selected ? "bg-white text-slate-900" : "bg-slate-700 text-slate-200"
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
      ))}
    </div>
  );
}
