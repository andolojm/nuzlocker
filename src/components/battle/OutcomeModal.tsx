import { useEffect } from "react";
import type { Item } from "../../api/pikaserve";
import type { OwnedTM } from "../../engine/gameStateEngine";

export interface OutcomeModalProps {
  variant: "victory" | "defeat" | "caught" | "ran";
  onAdvance: () => void;
  /** TM(s) awarded for this outcome, if any. Only ever set for "victory"/"caught". */
  awardedTMs?: OwnedTM[];
  /** Held item(s) awarded for this outcome, if any. Only ever set for "victory"/"caught". */
  awardedItems?: Item[];
  /** Berries awarded for this outcome, if any. Only ever set for "victory"/"caught". */
  awardedBerries?: Item[];
}

const TEXT: Record<OutcomeModalProps["variant"], string> = {
  victory: "Victory!",
  defeat: "Defeat...",
  caught: "Gotcha!",
  ran: "Disappointing.",
};

/** One "You received ..." block, listing what the outcome handed over. Renders nothing when empty. */
function AwardList({ heading, names }: { heading: string; names: string[] }) {
  if (names.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-sm font-semibold text-white">{heading}</p>
      <ul className="mt-1 space-y-0.5">
        {names.map((name, index) => (
          <li key={index} className="text-xs font-semibold text-slate-200">
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OutcomeModal({
  variant,
  onAdvance,
  awardedTMs = [],
  awardedItems = [],
  awardedBerries = [],
}: OutcomeModalProps) {
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
        <p className="text-4xl font-extrabold text-white drop-shadow-lg">{TEXT[variant]}</p>

        <AwardList
          heading={awardedTMs.length === 1 ? "You received a TM!" : `You received ${awardedTMs.length} TMs!`}
          names={awardedTMs.map((tm) => tm.move.name.english)}
        />
        <AwardList
          heading={awardedItems.length === 1 ? "You received an item!" : `You received ${awardedItems.length} items!`}
          names={awardedItems.map((item) => item.name.english)}
        />
        <AwardList
          heading={
            awardedBerries.length === 1 ? "You received a berry!" : `You received ${awardedBerries.length} berries!`
          }
          names={awardedBerries.map((berry) => berry.name.english)}
        />

        <p className="mt-3 text-xs font-semibold text-slate-300">Click, or press space/enter, to continue</p>
      </div>
    </div>
  );
}
