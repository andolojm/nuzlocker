import type { TeamPokemon } from "../../engine/gameStateEngine";

export interface EvolutionModalProps {
  /** Species name of the Pokemon before it evolved. */
  fromName: string;
  toPokemon: TeamPokemon;
  onClose: () => void;
}

export function EvolutionModal({ fromName, toPokemon, onClose }: EvolutionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-72 rounded-md bg-white p-4 text-center text-sm text-slate-900 min-[600px]:text-base"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="font-bold">
          Congrats! Your {fromName} has evolved into {toPokemon.name.english}!
        </p>

        <img
          src={toPokemon.image.hires}
          alt={toPokemon.name.english}
          className="mx-auto my-3 h-32 w-32 object-contain [image-rendering:pixelated]"
        />

        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-slate-800 px-6 py-2 text-sm font-bold text-white"
        >
          NEAT!
        </button>
      </div>
    </div>
  );
}
