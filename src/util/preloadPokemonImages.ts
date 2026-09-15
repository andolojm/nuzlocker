import pokedexData from "../vendor/pokemon-data/pokedex.json";
import type { RawPokemon } from "../api/pikaserve";

const pokedex = pokedexData as unknown as RawPokemon[];

/** How many image fetches run at once — keeps this from saturating the connection. */
const CONCURRENCY = 8;

export interface PreloadProgress {
  loaded: number;
  total: number;
}

function allImageUrls(): string[] {
  const urls = new Set<string>();
  for (const pokemon of pokedex) {
    urls.add(pokemon.image.sprite);
    urls.add(pokemon.image.hires);
  }
  return [...urls];
}

/**
 * Fetches every Pokemon sprite/hires image so the PWA's runtime-caching service worker (see
 * vite.config.ts) picks each one up and caches it for a year. A no-op if no service worker is
 * controlling the page (e.g. dev server without HTTPS, or the SW hasn't activated yet).
 */
export async function preloadAllPokemonImages(onProgress?: (progress: PreloadProgress) => void): Promise<void> {
  const urls = allImageUrls();
  let loaded = 0;
  onProgress?.({ loaded, total: urls.length });

  let nextIndex = 0;
  async function worker() {
    while (nextIndex < urls.length) {
      const url = urls[nextIndex++];
      try {
        await fetch(url, { mode: "no-cors" });
      } catch (error) {
        console.error(`Failed to preload ${url}`, error);
      }
      loaded++;
      onProgress?.({ loaded, total: urls.length });
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}
