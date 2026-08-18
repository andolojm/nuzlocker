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

/** A Pokemon's real, level/IV-scaled stats — not its raw species base stats. */
export function PokemonStatsList({ pokemon }: { pokemon: TeamPokemon }) {
  return (
    <ul>
      {STATS.map(({ key, label, isHp }) => (
        <li key={key}>
          {label}: {calculateStat(pokemon.base[key], pokemon.ivs[key], pokemon.level, isHp)} (IV {pokemon.ivs[key]})
        </li>
      ))}
    </ul>
  );
}
