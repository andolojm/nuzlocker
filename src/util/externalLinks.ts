function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function pokemonDbMoveUrl(name: string): string {
  return `https://pokemondb.net/move/${slugify(name)}`;
}

export function pokemonDbPokemonUrl(name: string): string {
  return `https://pokemondb.net/pokedex/${slugify(name)}`;
}

export function bulbapediaMoveUrl(name: string): string {
  return `https://bulbapedia.bulbagarden.net/wiki/${name.replace(/ /g, "_")}_(move)`;
}

export function bulbapediaPokemonUrl(name: string): string {
  return `https://bulbapedia.bulbagarden.net/wiki/${name.replace(/ /g, "_")}_(Pokémon)`;
}
