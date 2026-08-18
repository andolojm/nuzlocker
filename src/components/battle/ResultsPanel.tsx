import { useEffect } from "react";

export interface ResultsPanelProps {
  events: string[];
  onAdvance: () => void;
}

/** Full-width recap of everything that happened since the player's last decision. */
export function ResultsPanel({ events, onAdvance }: ResultsPanelProps) {
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
    <button
      type="button"
      onClick={onAdvance}
      className="flex h-full w-full flex-col justify-center gap-1 overflow-y-auto px-4 py-2 text-left"
    >
      <ul className="space-y-0.5">
        {events.map((event, index) => (
          <li key={index} className="text-sm font-medium text-white">
            {event}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] font-semibold text-slate-400">Click, or press space/enter, to continue</p>
    </button>
  );
}
