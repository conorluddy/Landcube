# Follow-up work

## Persistence

- First: restore the user's last chosen settings on their next visit, including design settings, custom location coordinates and span, and 3D/model settings. Keep this local to the browser initially, with versioned storage and a safe fallback for unavailable or invalid saved data. An explicit shared design link should take precedence over saved settings; restoring a location should not silently download terrain.
- Next: allow saving, naming, loading, renaming, and deleting presets for custom locations and complete designs.
- Consider account-backed sync later if needed.

## High-quality terrain and country-scale models

- Support whole-island/country compositions, starting with Ireland. Raise the current 200 km area-span limit after checking tile coverage, projection, memory, and export costs; target roughly 550–600 km framing for Ireland with margin.
- Separate geographic extent, source-data quality, mesh resolution, and physical print dimensions. Terrain detail must not depend on viewport size.
- Add bounded quality settings that select tile zoom and mesh density together, prioritizing high-quality output. Match resolution to physical print size rather than always requesting the finest available tiles over an entire country.
- Use bounded concurrent tile downloads, progress/cancellation, and worker-based mesh/export processing for larger jobs. Keep the interactive preview lighter than the final model while preserving the same terrain/framing.
- Add an Ireland preset with a portrait model shape and adjustable relief exaggeration. Begin with a rectangular sea-level base; a coastline-shaped solid is a separate future option requiring shoreline geometry.
