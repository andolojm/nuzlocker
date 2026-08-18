import { useEffect } from "react";
import type { OwnedTM } from "../../engine/gameStateEngine";

export interface TMSelectModalProps {
  tms: OwnedTM[];
  onSelect: (tm: OwnedTM) => void;
  onClose: () => void;
}

/** Stacks on top of PokemonInfoModal, letting the player pick an owned TM to teach. */
export function TMSelectModal({ tms, onSelect, onClose }: TMSelectModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="max-h-[80vh] w-72 overflow-y-auto rounded-md bg-white p-4 text-sm text-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">Choose a TM</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {tms.length === 0 ? (
          <p className="mt-3 italic text-slate-600">You don't have any TMs.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {tms.map((tm, index) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => onSelect(tm)}
                  className="w-full rounded-md bg-slate-100 px-3 py-2 text-left hover:bg-slate-200"
                >
                  <div className="font-semibold">{tm.name.english}</div>
                  <div className="text-xs text-slate-600">
                    {tm.move.name.english} ({tm.move.type})
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
