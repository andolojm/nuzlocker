import { BallIcon } from "./BallIcon";
import { useGridSelection } from "./useGridSelection";

const ACTIONS = ["FIGHT", "CATCH", "POKÉMON", "RUN"] as const;

/** Rounds to a whole percent, but never rounds a real (nonzero) chance down to "0%". */
function formatCatchChance(probability: number): string {
  if (probability <= 0) return "0%";
  const rounded = Math.round(probability * 100);
  return `${Math.max(rounded, 1)}%`;
}

export type BattleAction = (typeof ACTIONS)[number];

export interface BattleMenuProps {
  disabledActions?: BattleAction[];
  /** Whether this menu currently owns keyboard input (false while a submenu, e.g. move select, is open). */
  active?: boolean;
  /** Ball multiplier for the active Catch stage; shown as an icon on the CATCH button when set. */
  ballBonus?: number;
  /** Chance (0-1) that a ball thrown right now would catch the opponent; shown as a percentage next to the ball icon when set. */
  catchProbability?: number;
  /** `openedViaKeyboard` is true when the action was chosen with Space/Enter rather than a click. */
  onSelect?: (action: BattleAction, openedViaKeyboard: boolean) => void;
}

export function BattleMenu({
  disabledActions = [],
  active = true,
  ballBonus,
  catchProbability,
  onSelect,
}: BattleMenuProps) {
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
        const chanceLabel = showsBallIcon && catchProbability !== undefined ? formatCatchChance(catchProbability) : undefined;

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
            aria-label={showsBallIcon ? `CATCH${chanceLabel ? `, ${chanceLabel} chance` : ""}` : undefined}
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
            {showsBallIcon ? (
              <span className="flex items-center gap-1">
                <BallIcon ballBonus={ballBonus} className="h-8 w-8" />
                {chanceLabel && <span>{chanceLabel}</span>}
              </span>
            ) : (
              action
            )}
          </button>
        );
      })}
    </div>
  );
}
