# pokemon-data.json (vendored)

Static data files copied from [Purukitto/pokemon-data.json](https://github.com/Purukitto/pokemon-data.json)
at commit `b923263cd2a09f6ed41f6570ec582832fb4b4fb8` (2026-03-28). Not an npm package — upstream only
ships this as JSON files in a GitHub repo, so vendoring means copying them in directly.

Files: `pokedex.json`, `moves.json`, `items.json`, `types.json`. Image assets (`images/`) are **not**
vendored here — see the project's evaluation notes on image hosting cost/size before adding them.

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
