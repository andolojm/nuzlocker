export interface BattleLogProps {
  /** Turn headers and event lines, in order — see useBattleController's `battleLog`. */
  lines: string[];
}

/** Persistent scrollback of every turn's recap, shown under the battle screen. */
export function BattleLog({ lines }: BattleLogProps) {
  if (lines.length === 0) return null;

  return (
    <div className="mt-4 max-h-64 overflow-y-auto rounded-md border-2 border-slate-700 bg-slate-900 p-3">
      <ul className="space-y-0.5">
        {lines.map((line, index) => (
          <li
            key={index}
            className={
              line.startsWith("Turn ")
                ? "mt-2 text-sm font-bold text-white first:mt-0"
                : "text-sm font-medium text-slate-300"
            }
          >
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
