import type { Move } from "../../api/pikaserve";
import type { FourMoves } from "../../engine/gameStateEngine";
import { MoveTile } from "./MoveTile";
import { useGridSelection } from "./useGridSelection";

export interface MoveSelectMenuProps {
  moves: FourMoves;
  onSelectMove?: (move: Move) => void;
  onClose: () => void;
  /** When provided, shows an effectiveness indicator on each move tile against a defender with these types. */
  defenderTypes?: string[];
  /** When provided, shows a STAB star on each move tile matching one of these types. */
  attackerTypes?: string[];
  /** Whether a move starts selected. False means none is highlighted until an arrow key is pressed. Defaults to false. */
  startSelected?: boolean;
}

export function MoveSelectMenu({
  moves,
  onSelectMove,
  onClose,
  defenderTypes,
  attackerTypes,
  startSelected = false,
}: MoveSelectMenuProps) {
  const { selected, setSelected } = useGridSelection({
    itemCount: moves.length,
    columns: 2,
    isDisabled: () => false,
    onActivate: (index) => onSelectMove?.(moves[index]),
    onClose,
    startSelected,
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
          defenderTypes={defenderTypes}
          attackerTypes={attackerTypes}
        />
      ))}
    </div>
  );
}
