# Local WorldPacks

`brain-sweat-pack@1` has exactly `schema`, `id`, `version`, `worlds`. A pack has
one to four distinct, valid WorldSpecs and no executable files, assets, markup,
remote references or external dependencies. Validation compiles every contained
world before accepting the whole pack. One invalid member rejects the import.

Content hashes use the existing runtime's canonical serialization and SHA-256:
object keys sorted, array order preserved, finite JSON primitives only. World
hashes identify the exact spec. Pack hashes identify the exact ordered pack.
Receipts embed the validated pack, its hash, selected world hash, seed hierarchy
and controller bindings. Changing a rule, schedule, role or observation mask
changes that artifact identity. A hash is not a signature or permission.

The Academy's pack picker imports a local JSON file atomically and remains
stopped. Preview requires successful compilation. No network installation or
public marketplace exists. This format is a local package foundation; it does
not create a distribution service or grant imported authors code execution.

The optional local commands use the same compiler as the browser:

```sh
npm run world:list
npm run world:validate -- world-pack.json
npm --silent run world:run -- town-zero --seed 369 > town-receipt.json
npm run replay:verify -- town-receipt.json
npm --silent run experiment:batch -- frozen-manifest.json > results.json
```

The CLI host reads the named local file. A WorldSpec itself never gets a
filesystem handle, shell, callback, provider connection or arbitrary URL.
