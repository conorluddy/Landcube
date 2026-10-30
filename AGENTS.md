# LANDCU.BE

LANDCU.BE generates decorative topographic SVG and PNG artwork from seeded synthetic landscapes or real-world elevation tiles. It has a browser editor, an npm CLI, and an agent skill in `skills/landcube/`. Root `plugin.json` and `.agents/plugins/marketplace.json` package it for Codex; `.claude-plugin/` provides Claude Code manifests. Both use the same skill directory.

Browser and CLI share settings validation, terrain generation, contour extraction, composition, and SVG rendering. Browser PNG export uses canvas; Node PNG export uses Resvg. Real terrain uses public Terrarium elevation tiles with platform-specific decoding.

- `src/main.ts` and control modules own the browser experience; `src/ui/` holds the design-system components and tokens, and `src/studio/studio.css` the shell layout.
- `src/system/` is design-system mode: a lazy-loaded gallery inside the studio whose plates are the `src/ui` specimen definitions. See `src/system/README.md`.
- `src/cli.ts` owns CLI commands and configuration handling.
- `src/design-settings.ts` owns validated settings and versioned URL serialization; `src/design-sharing.ts` owns browser restoration and sharing.
- Terrain, contour, composition, and SVG modules form the shared rendering pipeline; `src/export/` owns export behavior.
- Shared domain constants and types live in `src/constants/` and `src/types/`.

Preserve reproducibility: existing version-one links depend on stable defaults and terrain semantics. Browser design links omit real-terrain locations; CLI configurations preserve terrain settings. The browser restores the last 3D look from localStorage (`src/studio/scene-storage.ts`) on every visit, since links do not carry it; the last design style restores only without a design link, so links never mix in stored values. Static exports use settled terrain without cursor deformation. Real-terrain output includes source attribution.

Keep browser and CLI behavior aligned through the shared pipeline.

## Git hygiene

- Use the PR template for all PRs.
- Default branch is protected - all updates via PR.
- PR titles use four words and one emoji prefix e.g. "🧑🏼‍💻 This is a title".

## Guides

- [docs/CODESTYLE.md](docs/CODESTYLE.md): code style, determinism rules, error handling, testing.
- [docs/SPECS.md](docs/SPECS.md): how to write issues, specs and acceptance criteria.
