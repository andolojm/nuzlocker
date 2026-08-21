/** Raw hex value per Pokemon type, for building backgrounds/gradients (e.g. PokemonInfoBox). */
export const TYPE_HEX_COLORS: Record<string, string> = {
  Normal: "#A8A878",
  Fire: "#F08030",
  Water: "#6890F0",
  Electric: "#F8D030",
  Grass: "#78C850",
  Ice: "#98D8D8",
  Fighting: "#C03028",
  Poison: "#A040A0",
  Ground: "#E0C068",
  Flying: "#A890F0",
  Psychic: "#F85888",
  Bug: "#A8B820",
  Rock: "#B8A038",
  Ghost: "#705898",
  Dragon: "#7038F8",
  Dark: "#705848",
  Steel: "#B8B8D0",
  Fairy: "#EE99AC",
};

const FALLBACK_TYPE_HEX = "#94A3B8";

/** Tailwind needs each of these as a literal string in source to generate the class — don't derive it from TYPE_HEX_COLORS. */
export const TYPE_COLORS: Record<string, string> = {
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

/** Hex color for `type`, falling back to a neutral gray for anything unrecognized. */
export function typeHexColor(type: string): string {
  return TYPE_HEX_COLORS[type] ?? FALLBACK_TYPE_HEX;
}

/** `type`'s color blended over a white background at `alpha` opacity (0-1), as an rgb() string. */
export function typeTintOnWhite(type: string, alpha: number): string {
  const hex = typeHexColor(type);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const blend = (channel: number) => Math.round(255 * (1 - alpha) + channel * alpha);
  return `rgb(${blend(r)}, ${blend(g)}, ${blend(b)})`;
}
