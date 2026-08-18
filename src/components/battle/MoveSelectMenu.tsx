import type { Move } from "../../api/pikaserve";
import type { FourMoves } from "../../engine/gameStateEngine";
import { MoveTile } from "./MoveTile";
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
        <MoveTile
          key={`${move.id}-${index}`}
          move={move}
          selected={index === selected}
          onClick={() => {
            setSelected(index);
            onSelectMove?.(move);
          }}
        />
      ))}
    </div>
  );
}
