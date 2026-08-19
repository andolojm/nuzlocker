import type { StatusCode } from "../../battle/formatBattleLine";
import type { TeamPokemon } from "../../engine/gameStateEngine";
import { bulbapediaPokemonUrl, pokemonDbPokemonUrl } from "../../util/externalLinks";
import { HpBar } from "./HpBar";

export interface PokemonInfoBoxProps {
  pokemon: TeamPokemon;
  hp: { current: number; max: number };
  status?: StatusCode | null;
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

function StatusChip({ status }: { status: StatusCode }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-bold text-white min-[600px]:text-xs ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

const TYPE_COLORS: Record<string, string> = {
  Normal: "bg-[#A8A878]",
  Fire: "bg-[#F08030]",
  Water: "bg-[#6890F0]",
  Electric: "bg-[#F8D030]",
  Grass: "bg-[#78C850]",
  Ice: "bg-[#98D8D8]",
  Fighting: "bg-[#C03028]",
  Poison: "bg-[#A040A0]",
  Ground: "bg-[#E0C068]",
  Flying: "bg-[#A890F0]",
  Psychic: "bg-[#F85888]",
  Bug: "bg-[#A8B820]",
  Rock: "bg-[#B8A038]",
  Ghost: "bg-[#705898]",
  Dragon: "bg-[#7038F8]",
  Dark: "bg-[#705848]",
  Steel: "bg-[#B8B8D0]",
  Fairy: "bg-[#EE99AC]",
};

function TypeChip({ type }: { type: string }) {
  return (
    <span
      className={`rounded px-1 py-0.5 text-[8px] font-bold text-white min-[600px]:text-[10px] ${TYPE_COLORS[type] ?? "bg-slate-400"}`}
    >
      {type.toUpperCase()}
    </span>
  );
}

export function PokemonInfoBox({ pokemon, hp, status, onInfoClick }: PokemonInfoBoxProps) {
  return (
    <div className="w-56 rounded-lg border-2 border-slate-700 bg-slate-100 px-3 py-2 shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-900 min-[600px]:text-base">{pokemon.name.english}</span>
        <div className="flex items-center gap-1.5">
          {status && <StatusChip status={status} />}
          <span className="text-xs font-semibold text-slate-700 min-[600px]:text-sm">Lv{pokemon.level}</span>
        </div>
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
