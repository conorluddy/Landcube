---
name: landcube
description: Generate reproducible topographic SVG or PNG assets with the LANDCU.BE CLI. Use for requests for contour-map backgrounds, synthetic terrain artwork, or location-based terrain exports; do not use for ordinary geographic maps or GIS analysis.
---

# LANDCU.BE

Create a production-ready image and its versioned LANDCU.BE configuration. Use `npx --yes landcube` so the workflow works without a repository checkout.

## Generate an asset

Translate the brief into an SVG or PNG, dimensions, palette, and any relevant terrain or contour controls. Start with `npx --yes landcube presets --json true` when choosing a named palette, size, or terrain preset would help. Use explicit flags rather than relying on unstated defaults whenever a brief specifies a visual decision.

Always create the image together with a JSON configuration using `--save-config`. Use a matching basename, for example `hero.svg` and `hero.json`. Validate saved configuration with `npx --yes landcube validate --config hero.json` after generation. Report the output paths and exact generation command to the user.

If the request does not specify an output destination, inspect the current workspace for relevant conventions such as an existing asset directory, build output directory, or documentation examples. Use a suitable existing asset directory when the intended destination is clear. For standalone experiments or previews, create a descriptive directory under the system temporary directory (for example `/tmp/landcube-slieve-league/`) and report it. Ask only when the destination would materially affect how the asset is used. Do not put generated files in the workspace root by default.

## Terrain choices

Use generated terrain unless the request names a real location, coordinates, or requests geographic terrain. For real terrain, use `--terrain-preset NAME` when an available preset matches; otherwise pass `--terrain real --latitude NUMBER --longitude=NUMBER --span-km NUMBER`. Use equals syntax for negative coordinates (for example `--longitude=-8.707332`) so commands also work with older CLI versions.

New real-terrain designs omit depths below sea level by default (`--max-depth 0`). Use `--max-depth METERS` when the brief calls for bathymetry, for example `--max-depth 100`. Existing configurations without `maxDepth` retain their original depth range; pass the flag explicitly to update them.

For coastal artwork, inspect the generated image: the public tiles combine land elevation and bathymetry and can contain stepped source boundaries near shore. If those artifacts are visible, try `--elevation-floor METERS` to omit affected low elevations, inspect again, and report the chosen cutoff. This intentionally removes low terrain; it does not reconstruct an accurate shoreline. Omit the option when all elevations should be retained.

Real-terrain exports embed resolved attribution. Also create a companion text credit with `--attribution-file`, using the same basename (for example `hero-attribution.txt`), and tell the user that the final published medium must display the credit where reasonable.

## Output and safety

Use SVG by default for scalable design assets; select PNG only when raster output is requested. Use `--force true` only when the user explicitly authorizes replacing an existing artifact. Keep `--output -` for pipelines that explicitly require image bytes on stdout; it cannot be combined with JSON output.

Use `--help --verbose` when a requested parameter needs detailed interpretation. The CLI reports invalid ranges, incompatible options, and output-extension mismatches; fix those inputs rather than bypassing validation.

When generation fails, inspect the reported output paths before retrying. Older CLI versions may save a configuration before a terrain download fails. If that matching configuration exists, retry using `--config FILE` and omit `--save-config`; do not add `--force true` just to recover. Network failures require checking connectivity or runtime network permissions, not changing the terrain to generated mode.
