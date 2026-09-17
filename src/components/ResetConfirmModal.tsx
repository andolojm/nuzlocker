export interface ResetConfirmModalProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export function ResetConfirmModal({ onCancel, onConfirm }: ResetConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="w-[90vw] max-w-[400px] rounded-md bg-white p-4 text-center text-sm text-slate-900 min-[600px]:text-base"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="font-bold">Are you sure?</p>
        <p className="mt-2 text-slate-700">This will erase all current progress. Hall of fame data will be saved.</p>

        <div className="mt-4 flex justify-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md bg-slate-500 px-6 py-2 text-sm font-bold text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-6 py-2 text-sm font-bold text-white"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
