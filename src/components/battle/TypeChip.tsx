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

/** A small colored chip naming one Pokemon type, as shown on the battle screen's info cards. */
export function TypeChip({ type }: { type: string }) {
  return (
    <span
      className={`rounded px-1 py-0.5 text-[8px] font-bold text-white min-[600px]:text-[10px] ${TYPE_COLORS[type] ?? "bg-slate-400"}`}
    >
      {type.toUpperCase()}
    </span>
  );
}
