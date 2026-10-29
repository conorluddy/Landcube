# Follow-up work

## Persistence

- First: restore the user's last chosen settings on their next visit, including design settings, custom location coordinates and span, and 3D/model settings. Keep this local to the browser initially, with versioned storage and a safe fallback for unavailable or invalid saved data. An explicit shared design link should take precedence over saved settings; restoring a location should not silently download terrain.
- Next: allow saving, naming, loading, renaming, and deleting presets for custom locations and complete designs.
- Consider account-backed sync later if needed.

## High-quality terrain and country-scale models

- Done: whole-island compositions. Spans reach 800 km, with Ireland (800 km landscape) and Iceland (600 km) presets and Mercator-accurate floor graticules.
- Separate geographic extent, source-data quality, mesh resolution, and physical print dimensions. Terrain detail must not depend on viewport size.
- Done: **Elevation detail** (`--terrain-detail` standard, high, max) selects tile zoom and 2D sampling density together from the output size, within per-level tile budgets. Next: let the 3D model's physical print size drive mesh density as well.
- Done: bounded concurrent tile downloads and a persistent CLI tile cache. Next: progress/cancellation and worker-based mesh/export processing for larger jobs. Keep the interactive preview lighter than the final model while preserving the same terrain/framing.
- Add an Ireland preset with a portrait model shape and adjustable relief exaggeration. Begin with a rectangular sea-level base; a coastline-shaped solid is a separate future option requiring shoreline geometry.
