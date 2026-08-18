import type { TeamPokemon } from "../../engine/gameStateEngine";

export type PartySlot =
  | { status: "empty" }
  | { status: "active" | "available" | "fainted"; pokemon: TeamPokemon; hp: { current: number; max: number } };
