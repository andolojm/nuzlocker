export interface PreloadImagesConfirmModalProps {
  onCancel: () => void;
  onConfirm: () => void;
}

/** Warns before kicking off preloadAllPokemonImages, since it's a lot of data for a mobile connection. */
export function PreloadImagesConfirmModal({ onCancel, onConfirm }: PreloadImagesConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="w-[90vw] max-w-[400px] rounded-md bg-white p-4 text-center text-sm text-slate-900 min-[600px]:text-base"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="font-bold">Download 1700+ images?</p>
        <p className="mt-2 text-slate-700">
          This caches every Pokémon's artwork for offline use, which is a lot of data. You should
          be on Wi-Fi before starting.
        </p>

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
            className="rounded-md bg-slate-800 px-6 py-2 text-sm font-bold text-white"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
