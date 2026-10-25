---
name: topogra
description: Generate reproducible topographic SVG or PNG assets with the Topogra CLI. Use for requests for contour-map backgrounds, synthetic terrain artwork, or location-based terrain exports; do not use for ordinary geographic maps or GIS analysis.
---

# Topogra

Create a production-ready image and its versioned Topogra configuration. Use `npx --yes topogra` so the workflow works without a repository checkout.

## Generate an asset

Translate the brief into an SVG or PNG, dimensions, palette, and any relevant terrain or contour controls. Start with `npx --yes topogra presets --json true` when choosing a named palette, size, or terrain preset would help. Use explicit flags rather than relying on unstated defaults whenever a brief specifies a visual decision.

Always create the image together with a JSON configuration using `--save-config`. Use a matching basename, for example `hero.svg` and `hero.json`. Validate saved configuration with `npx --yes topogra validate --config hero.json` after generation. Report the output paths and exact generation command to the user.

If the request does not specify an output destination, inspect the current workspace for relevant conventions such as an existing asset directory, build output directory, or documentation examples. Then ask once for a destination, offering concise context-driven suggestions. Do not put generated files in the workspace root by default.

## Terrain choices

Use generated terrain unless the request names a real location, coordinates, or requests geographic terrain. For real terrain, use `--terrain-preset NAME` when an available preset matches; otherwise pass `--terrain real --latitude NUMBER --longitude NUMBER --span-km NUMBER`.

Real-terrain exports embed resolved attribution. Also create a companion text credit with `--attribution-file`, using the same basename (for example `hero-attribution.txt`), and tell the user that the final published medium must display the credit where reasonable.

## Output and safety

Use SVG by default for scalable design assets; select PNG only when raster output is requested. Use `--force true` only when the user explicitly authorizes replacing an existing artifact. Keep `--output -` for pipelines that explicitly require image bytes on stdout; it cannot be combined with JSON output.

Use `--help --verbose` when a requested parameter needs detailed interpretation. The CLI reports invalid ranges, incompatible options, and output-extension mismatches; fix those inputs rather than bypassing validation.
