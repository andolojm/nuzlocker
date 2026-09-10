import { calculateStat } from "../../engine/stats";
import type { TeamPokemon } from "../../engine/gameStateEngine";

const STATS: { key: keyof TeamPokemon["base"]; label: string; isHp: boolean }[] = [
  { key: "HP", label: "HP", isHp: true },
  { key: "Attack", label: "Attack", isHp: false },
  { key: "Defense", label: "Defense", isHp: false },
  { key: "Sp. Attack", label: "Sp. Attack", isHp: false },
  { key: "Sp. Defense", label: "Sp. Defense", isHp: false },
  { key: "Speed", label: "Speed", isHp: false },
];

/**
 * A Pokemon's real, level/IV-scaled stats — not its raw species base stats.
 *
 * `censorIvs` hides the exact IV (used for opponents, whose IVs the player shouldn't see) and shows
 * a fixed `(+IV ??)` placeholder instead. The stat value itself is still exact.
 */
export function PokemonStatsList({
  pokemon,
  censorIvs = false,
}: {
  pokemon: TeamPokemon;
  censorIvs?: boolean;
}) {
  return (
    <ul>
      {STATS.map(({ key, label, isHp }) => (
        <li key={key}>
          {label}: <span className="font-bold">{calculateStat(pokemon.base[key], pokemon.ivs[key], pokemon.level, isHp)}</span>{" "}
          <span className="text-xs italic">{censorIvs ? "(+IV ??)" : `(IV ${pokemon.ivs[key]})`}</span>
        </li>
      ))}
    </ul>
  );
}
