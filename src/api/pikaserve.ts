export interface LocalizedName {
  english: string;
  japanese?: string;
  chinese?: string;
  french?: string;
}

export interface PokemonBaseStats {
  HP: number;
  Attack: number;
  Defense: number;
  "Sp. Attack": number;
  "Sp. Defense": number;
  Speed: number;
}

export interface PokemonEvolution {
  prev?: [string, string];
  next?: [string, string][];
}

export interface PokemonProfile {
  height: string;
  weight: string;
  egg: string[];
  ability: [string, string][];
  gender: string;
}

export interface PokemonImage {
  sprite: string;
  thumbnail: string;
  hires: string;
}

export interface PokemonIVs {
  HP: number;
  Attack: number;
  Defense: number;
  "Sp. Attack": number;
  "Sp. Defense": number;
  Speed: number;
}

export interface Pokemon {
  id: number;
  name: LocalizedName;
  type: string[];
  base: PokemonBaseStats;
  species: string;
  /** Sum of the six base stats, precomputed in the vendored pokedex data rather than derived on every read. */
  bst: number;
  description: string;
  evolution?: PokemonEvolution;
  profile: PokemonProfile;
  image: PokemonImage;
  catchRate: number;
  ivs: PokemonIVs;
}

const IV_MIN = 0;
const IV_MAX = 31;

function randomIV(): number {
  return Math.floor(Math.random() * (IV_MAX - IV_MIN + 1)) + IV_MIN;
}

/** PikaServe doesn't return IVs either, so every fetch gets freshly rolled 0-31 IVs per stat. */
function randomIVs(): PokemonIVs {
  return {
    HP: randomIV(),
    Attack: randomIV(),
    Defense: randomIV(),
    "Sp. Attack": randomIV(),
    "Sp. Defense": randomIV(),
    Speed: randomIV(),
  };
}

/** Catch rate comes from vendored pokedex data (src/vendor/pokemon-data); only IVs are still synthesized. */
export type RawPokemon = Omit<Pokemon, "ivs">;

export function enrichPokemon(pokemon: RawPokemon): Pokemon {
  return { ...pokemon, ivs: randomIVs() };
}

export interface Move {
  id: string;
  name: LocalizedName;
  type: string;
  category: string;
  pp: string;
  power: string;
  accuracy: string;
}

export interface Item {
  id: number;
  type: string;
  description: string;
  name: LocalizedName;
}

/** A TM: every move is teachable, one-to-one, via its own TM (id doubles as the move's own id). */
export interface TM {
  id: number;
  move: Move;
}

export interface PokemonType {
  english: string;
  chinese: string;
  japanese: string;
  effective: string[];
  ineffective: string[];
  no_effect: string[];
}

export type NameOrId = string | number;
