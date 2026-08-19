export interface PartyNotFullWarningModalProps {
  /** Dismisses the modal and returns to team selection. */
  onBack: () => void;
  /** Proceeds to battle with the currently selected (not-full) active team. */
  onProceed: () => void;
}

export function PartyNotFullWarningModal({ onBack, onProceed }: PartyNotFullWarningModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onBack}>
      <div
        className="w-[90vw] max-w-[400px] rounded-md bg-white p-4 text-center text-sm text-slate-900 min-[600px]:text-base"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold">Warning: Party's not full</p>
          <button type="button" onClick={onBack} aria-label="Close" className="shrink-0">
            ✕
          </button>
        </div>

        <div className="mt-4 flex justify-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md bg-slate-500 px-6 py-2 text-sm font-bold text-white"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onProceed}
            className="rounded-md bg-slate-800 px-6 py-2 text-sm font-bold text-white"
          >
            I Know
          </button>
        </div>
      </div>
    </div>
  );
}
