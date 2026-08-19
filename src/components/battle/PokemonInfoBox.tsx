import type { StatusCode } from "../../battle/formatBattleLine";
import type { TeamPokemon } from "../../engine/gameStateEngine";
import { bulbapediaPokemonUrl, pokemonDbPokemonUrl } from "../../util/externalLinks";
import { HpBar } from "./HpBar";
import { TypeChip } from "./TypeChip";

export interface PokemonInfoBoxProps {
  pokemon: TeamPokemon;
  hp: { current: number; max: number };
  status?: StatusCode | null;
  /** Where the status chip hangs outside the box's border. Defaults to "bottom-right". */
  statusChipPosition?: "top-left" | "bottom-right";
  /** Renders an "INFO" link that opens the PokemonInfoModal. Omit to hide it. */
  onInfoClick?: () => void;
}

const STATUS_LABELS: Record<StatusCode, string> = {
  brn: "BRN",
  par: "PAR",
  slp: "SLP",
  frz: "FRZ",
  psn: "PSN",
  tox: "PSN",
};

const STATUS_COLORS: Record<StatusCode, string> = {
  brn: "bg-orange-500",
  par: "bg-yellow-500",
  slp: "bg-slate-400",
  frz: "bg-cyan-400",
  psn: "bg-purple-500",
  tox: "bg-purple-500",
};

const STATUS_BORDER_COLORS: Record<StatusCode, string> = {
  brn: "border-orange-500",
  par: "border-yellow-500",
  slp: "border-slate-400",
  frz: "border-cyan-400",
  psn: "border-purple-500",
  tox: "border-purple-500",
};

const CHIP_POSITION_CLASSES: Record<"top-left" | "bottom-right", string> = {
  "top-left": "-top-2 -left-2",
  "bottom-right": "-bottom-2 -right-2",
};

function StatusChip({ status, position }: { status: StatusCode; position: "top-left" | "bottom-right" }) {
  return (
    <span
      className={`absolute ${CHIP_POSITION_CLASSES[position]} rounded px-1.5 py-0.5 text-[10px] font-bold text-white shadow min-[600px]:text-xs ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PokemonInfoBox({
  pokemon,
  hp,
  status,
  statusChipPosition = "bottom-right",
  onInfoClick,
}: PokemonInfoBoxProps) {
  const borderClass = status ? STATUS_BORDER_COLORS[status] : "border-slate-700";

  return (
    <div className={`relative w-56 rounded-lg border-2 ${borderClass} bg-slate-100 px-3 py-2 shadow-md`}>
      {status && <StatusChip status={status} position={statusChipPosition} />}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-900 min-[600px]:text-base">{pokemon.name.english}</span>
        <span className="text-xs font-semibold text-slate-700 min-[600px]:text-sm">Lv{pokemon.level}</span>
      </div>
      <div className="mt-1.5">
        <HpBar current={hp.current} max={hp.max} />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="flex gap-2 text-[10px] text-slate-600 min-[600px]:text-xs">
          <a
            href={pokemonDbPokemonUrl(pokemon.name.english)}
            target="_blank"
            rel="noopener noreferrer"
            title="PMDB"
            className="underline"
          >
            PMDB
          </a>
          <a
            href={bulbapediaPokemonUrl(pokemon.name.english)}
            target="_blank"
            rel="noopener noreferrer"
            title="Bulba"
            className="underline"
          >
            Bulba
          </a>
          {onInfoClick && (
            <button type="button" onClick={onInfoClick} className="underline">
              INFO
            </button>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          {pokemon.type.map((type) => (
            <TypeChip key={type} type={type} />
          ))}
        </div>
      </div>
    </div>
  );
}
