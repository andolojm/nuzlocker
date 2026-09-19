# pokemon-data.json (vendored)

Static data files copied from [Purukitto/pokemon-data.json](https://github.com/Purukitto/pokemon-data.json)
at commit `b923263cd2a09f6ed41f6570ec582832fb4b4fb8` (2026-03-28). Not an npm package — upstream only
ships this as JSON files in a GitHub repo, so vendoring means copying them in directly.

Files: `pokedex.json`, `moves.json`, `items.json`, `types.json`. Image assets (`images/`) are **not**
vendored here — see the project's evaluation notes on image hosting cost/size before adding them.

`abilities.json` is **not** from this upstream — see the "abilities.json" section below.

To refresh: re-download the four files above from the `master` branch and update the commit hash in
this note. Note that a refresh will overwrite the `catchRate` and `bst` fields added to `pokedex.json`
(see below) — re-run the merge against upstream's fresh data rather than blindly overwriting the file.

## bst field

Each `pokedex.json` entry also has a `bst` (base stat total) field: the sum of `base.HP + Attack +
Defense + "Sp. Attack" + "Sp. Defense" + Speed`, precomputed once here rather than recalculated on
every read. It's a pure function of `base`, so if `base` is ever hand-edited, `bst` must be
recalculated to match.

## catchRate field

`pokedex.json` entries deviate from upstream: each one has a `catchRate` field added, sourced from
[Bulbapedia's List of Pokémon by catch rate](https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_by_catch_rate)
(the base-game catch rate, i.e. the first/default form's value — alternate-form rows on that page,
e.g. Partner Pikachu, are not represented since this pokedex has no alternate-form entries). All 898
entries (national dex 1–898) were matched by id with zero gaps and zero name mismatches as of the
data pulled 2026-08-15.

## hires images

`pokedex.json` entries for ids 810–898 (gen 8) deviate from upstream: their `image.hires` points at
the same URL as `image.thumbnail`. Upstream's `images/pokedex/hires/*.png` for that range are
malformed palette PNGs with no alpha channel, so they render on an opaque white box (Eiscue is the
obvious one), and Morpeko (877) has no `hires` entry at all. For those 89 — and only those — the
thumbnail *is* the full-size 475×475 transparent official artwork, identical to PokeAPI's
`official-artwork` image, while gen 1–7 thumbnails are 100×100. Ids 1–809 are untouched.

`pokedexImages.test.ts` asserts the swap stays in place, so a refresh that reintroduces the broken
URLs fails there. Re-check upstream on a refresh: if they fix their gen 8 hires art, this deviation
can be dropped.

## Hold items

`items.json` entries with `type: "Hold items"` are the pool the game hands out and lets a Pokémon
carry into battle. Not all of them are usable: some have no `@pkmn/sim` entry at all, and Mega Stones
and Z-Crystals do nothing in gen 9. Those are listed by id in `src/api/heldItems.ts`, which
`heldItems.test.ts` re-derives from the sim's own data — so a data refresh that shifts the set fails
that test rather than quietly handing out items that do nothing.

## abilities.json

Not from Purukitto/pokemon-data.json (which only ships ability *names* per species, no
descriptions). Scraped from [PokémonDB's ability list](https://pokemondb.net/ability) on
2026-09-09: one entry per ability with `id` (1-based, alphabetical), `name`, `description`, and a
`hidden` boolean.

`hidden` is a **local curation flag, not the games' hidden-ability concept.** When `true`, the
ability is excluded from the random-ability assignment pool (`PikaLocal.getRandomAbility`). It's set
for abilities that don't behave sensibly on an arbitrary Pokémon: form-change abilities tied to one
species (Zero to Hero, Battle Bond, …), and abilities the `@pkmn/sim` battle engine has no generic
entry for (As One, Embody Aspect). Every non-hidden ability's `name` maps to a real
`Dex.abilities.get(toID(name))` in `@pkmn/sim`, which is what the battle engine is handed.

To regenerate: update the scraped rows in `scripts/generate-abilities.cjs` and run
`node scripts/generate-abilities.cjs` from the repo root. Keep the `id` order stable (ids are 1-based
alphabetical positions) and re-review the `HIDDEN` list in that script against the current
`@pkmn/sim` data.
