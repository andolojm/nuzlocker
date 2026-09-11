import { BallIcon } from "./BallIcon";
import { useGridSelection } from "./useGridSelection";

const ACTIONS = ["FIGHT", "CATCH", "POKÉMON", "RUN"] as const;

export type BattleAction = (typeof ACTIONS)[number];

export interface BattleMenuProps {
  disabledActions?: BattleAction[];
  /** Whether this menu currently owns keyboard input (false while a submenu, e.g. move select, is open). */
  active?: boolean;
  /** Ball multiplier for the active Catch stage; shown as an icon on the CATCH button when set. */
  ballBonus?: number;
  /** `openedViaKeyboard` is true when the action was chosen with Space/Enter rather than a click. */
  onSelect?: (action: BattleAction, openedViaKeyboard: boolean) => void;
}

export function BattleMenu({ disabledActions = [], active = true, ballBonus, onSelect }: BattleMenuProps) {
  const { selected, setSelected } = useGridSelection({
    itemCount: ACTIONS.length,
    columns: 2,
    isDisabled: (index) => disabledActions.includes(ACTIONS[index]),
    onActivate: (index) => onSelect?.(ACTIONS[index], true),
    active,
  });

  return (
    <div
      role="menu"
      aria-label="Battle actions"
      className="grid h-full grid-cols-2 grid-rows-2 gap-1 rounded-lg border-2 border-slate-700 bg-slate-100 p-2"
    >
      {ACTIONS.map((action, index) => {
        const disabled = disabledActions.includes(action);
        const showsBallIcon = action === "CATCH" && ballBonus !== undefined;

        return (
          <button
            key={action}
            type="button"
            role="menuitemradio"
            aria-checked={index === selected}
            disabled={disabled}
            tabIndex={-1}
            onClick={() => {
              setSelected(index);
              onSelect?.(action, false);
            }}
            aria-label={showsBallIcon ? "CATCH" : undefined}
            className={`flex items-center justify-center rounded-md text-sm font-bold ${
              showsBallIcon ? "border-2 border-green-500" : ""
            } ${
              disabled
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : index === selected
                  ? "bg-slate-800 text-white"
                  : "bg-slate-200 text-slate-800"
            }`}
          >
            {showsBallIcon ? <BallIcon ballBonus={ballBonus} className="h-8 w-8" /> : action}
          </button>
        );
      })}
    </div>
  );
}
