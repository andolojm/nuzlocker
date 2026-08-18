import { useEffect } from "react";
import type { OwnedTM } from "../../engine/gameStateEngine";

export interface OutcomeModalProps {
  variant: "victory" | "defeat" | "caught";
  onAdvance: () => void;
  /** TM(s) awarded for this outcome, if any. Only ever set for "victory"/"caught". */
  awardedTMs?: OwnedTM[];
}

const TEXT: Record<OutcomeModalProps["variant"], string> = {
  victory: "Victory!",
  defeat: "Defeat...",
  caught: "Gotcha!",
};

export function OutcomeModal({ variant, onAdvance, awardedTMs = [] }: OutcomeModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onAdvance();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onAdvance]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAdvance}
      className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-black/60"
    >
      <div className="text-center">
        <p className="text-4xl font-extrabold tracking-wide text-white drop-shadow-lg">{TEXT[variant]}</p>

        {awardedTMs.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-semibold text-white">
              {awardedTMs.length === 1 ? "You received a TM!" : `You received ${awardedTMs.length} TMs!`}
            </p>
            <ul className="mt-1 space-y-0.5">
              {awardedTMs.map((tm, index) => (
                <li key={index} className="text-xs font-semibold text-slate-200">
                  {tm.name.english} — {tm.move.name.english}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-3 text-xs font-semibold text-slate-300">Click, or press space/enter, to continue</p>
      </div>
    </div>
  );
}
