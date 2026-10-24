# Topogra

A local topographic background generator with a cursor-driven hill, glass style panel, shareable designs, and SVG/PNG export. Everything runs in the browser; no accounts, backend, external assets, or runtime network requests.

## Run locally

Requires Node.js 22.13+ (or 20.19+ / 24+) and npm.

```sh
npm install
npm run dev
```

Open the URL printed by Vite (normally http://127.0.0.1:5173). Stop the server with Ctrl+C.

```sh
npm test              # Geometry, settings, sharing, and export logic
npm run test:coverage # Node's coverage report; use Node 22.12+
npm run build        # Strict TypeScript checking and production build
npm run preview      # Serve dist/ locally
npm run test:e2e     # Critical browser journeys; requires installed Google Chrome
npm run lint         # Strict type-aware linting; zero warnings allowed
npm run lint:fix     # Apply safe automatic lint fixes
npm run format       # Format source, styles, configuration, and documentation
npm run format:check # Check formatting without changing files
```

Browser tests inline the production bundle into `.cache/browser-fixture.html`, so they need no HTTP server or runtime network. They cover link restoration, SVG/PNG downloads, transparency, resolution, mobile layout, clipboard fallback, and keyboard navigation. Build artifacts, browser traces, and screenshots are ignored. The Node coverage report covers the imported logic modules; it does not measure the browser interface.

## Code quality

ESLint uses the TypeScript ESLint strict and stylistic presets with type information. It rejects unsafe `any` usage, non-null assertions, unhandled promises, nullable values in boolean conditions, loose equality, unused code, and incomplete switches over unions. Public module boundaries require explicit types; type imports and braces are enforced. Intentional unused parameters in stubs use an `_` prefix.

Prettier handles layout: two-space indentation, single quotes, semicolons, trailing commas, LF line endings, and a 100-character target line width. Objects deliberately written across multiple lines stay expanded. ESLint Stylistic adds blank lines around control-flow blocks and functions, before returns, after import groups, and after variable declaration groups; consecutive declarations stay together. Add blank lines between other logical steps where they help explain the code; Prettier preserves single blank lines.

Run `npm run lint:fix` followed by `npm run format` to apply both spacing and layout. Generated output, validation images, caches, and the npm-managed lockfile are excluded from formatting. CI fails on formatting differences or any lint warning.

## CI and GitHub Pages

[Build and deploy site](.github/workflows/build.yml) runs on pushes, pull requests, and manual dispatch. It installs locked dependencies with Node.js 22, checks formatting and linting, runs the logic tests, builds the production site into `dist/`, and uploads that directory as the `github-pages` artifact. Successful builds on `main` also deploy the artifact to GitHub Pages; pull requests only run the checks and build.

The build uses relative asset URLs and publishes to `https://conorluddy.github.io/Topogra/`. The repository’s Pages source must be **GitHub Actions**, so deployment serves the compiled `dist/` artifact. See [GitHub’s custom Pages workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) for the deployment job and its permissions.

## Style controls

The minus button collapses the panel to its header; plus reopens it. Escape collapses controls while focus is inside. Small screens scroll within the panel.

- Choose Charcoal, Paper, Blueprint, or Bold, then adjust canvas/contour colours, opacity, and line weight.
- Density changes elevation levels; scale changes landform size; detail blends smaller features into the terrain. Style changes retain the seed.
- Expand Index contours for dashed/solid/off, frequency, weight, and dash/gap lengths. Inactive settings are retained.
- Expand Cursor interaction for enabled state, radius, strength, and response time. Negative strength creates a depression. Interaction settles while using the panel; reduced motion removes easing.
- New landscape generates a fresh seed. Lock disables regeneration and saves the seed locally when storage is available.
- Reset style restores appearance and cursor defaults while preserving seed, lock, and output options.

## Export

Open Export in the footer to choose SVG or PNG, dimensions, transparency, and PNG resolution. Its preview shows the complete settled output without the cursor hill or interface. Escape closes export options before collapsing the panel.

Use viewport captures the current browser dimensions. Landscape (1920 × 1080), square (1080 × 1080), portrait (1080 × 1920), and custom dimensions are available. Dimensions remain fixed when the browser resizes; the main background still fills the browser. Larger outputs reveal more of the same terrain from the top-left origin at the same feature scale.

Each output side must be an integer from 64–4096 px by default. “Allow extra-large exports” raises the limit to 12,288 px per side and displays a memory warning. PNG offers 1× and 2×; final raster dimensions must fit the selected limit. A 12,288² PNG needs 576 MiB for a single pixel buffer, plus rendering and encoding overhead; browser limits still apply. Turning the option off clamps oversized dimensions to 4096 px. The 2× option doubles pixel resolution and stroke pixels while preserving composition. SVG remains vector at its selected dimensions and ignores PNG scale. Transparent previews use a checkerboard that is excluded from the file.

Exports are standalone, clipped to their output frame, and include explicit colours. Filenames use `topogra-SEED-WIDTHxHEIGHT.svg` or `.png`, with actual file dimensions. Export captures settings at download time, so later edits do not change an in-progress download.

## Share and restore

Every committed edit updates the address bar after 250 ms using `replaceState`, without adding history entries. Reloading that URL restores its design. Copy link immediately flushes pending edits and copies the complete URL; if clipboard access is unavailable, a selectable link appears for manual copying.

A plain URL starts a fresh landscape, preferring a locally locked seed. An explicit URL seed overrides local storage without overwriting it. The seed lock and panel expansion are local UI state, not shared design settings. Temporary cursor position and deformation are never saved.

### Version-one URL contract

Generated links include `v=1` and all fields, even defaults and inactive settings. Colours are six-digit hex strings including `#`, encoded by `URLSearchParams`; booleans are `true`/`false`. Missing fields use immutable version-one defaults; missing seed uses the locally locked seed or a fresh one on initial load. Plain visits capture initial viewport dimensions. Partial design links otherwise use 1440 × 900 output defaults.

| Group          | Query parameters                                                        |
| -------------- | ----------------------------------------------------------------------- |
| Terrain        | `seed`, `featureScale`, `detail`, `contourCount`                        |
| Appearance     | `background`, `lineColor`, `strokeOpacity`, `strokeWidth`               |
| Index contours | `indexStyle`, `indexEvery`, `indexStrokeWidth`, `dashLength`, `dashGap` |
| Cursor         | `cursorEnabled`, `cursorRadius`, `cursorHeight`, `cursorResponseMs`     |
| Output         | `format`, `width`, `height`, `pngScale`, `transparent`                  |

`seed` is an unsigned 32-bit integer. Numeric ranges and steps match the controls and are defined in `src/constants/design.ts`. `indexStyle` is `dashed`, `solid`, or `off`; `format` is `svg` or `png`; `pngScale` is `1` or `2`. Invalid individual values revert to their version-one defaults with one notice. Unsupported versions load defaults with a notice. Unknown parameters are ignored and omitted when the URL is synchronized.

Version-one defaults and engine constants must stay stable to preserve existing links. Changes to noise generation, contour interpretation, or saved-default semantics require a new version and a compatible version-one reader/renderer.

## Implementation

- `src/design-settings.ts`: validation, URL serialization, and derived terrain configuration. Shared contracts are in `src/types/`; defaults, numeric constraints, and engine values are in `src/constants/`.
- `src/design-sharing.ts`: startup seed precedence, local seed storage, address-bar synchronization, and clipboard handling.
- `src/design-controls.ts`: live style controls, presets, collapse, seed actions, and share feedback.
- `src/constants/engine.ts`: immutable internal sampling, elevation bounds, and performance constants.
- `src/terrain-generation.ts` and `src/contour-extraction.ts`: seeded smooth noise, bounded sampling, marching squares, saddle decisions, and stitched paths.
- `src/landscape-composition.ts` and `src/svg-rendering.ts`: settled composition generation and SVG markup shared by the background, preview, and export.
- `src/export/`: output controls, cached settled geometry, SVG files, PNG encoding, and download resource cleanup.
- `src/main.ts`: application state, cursor lifecycle, scheduled rendering, and debounced resizing.

The grid extends beyond the visible frame. Sampling uses CSS pixels, and resizing retains the seed and top-left world origin. Very large frames double grid spacing until they fit the sample budget; this can slightly change polygon approximation while preserving the continuous terrain. Dense sampling keeps contours flowing without curve smoothing that could introduce crossings.

Appearance changes reuse cached contours. Output geometry is separate from cursor animation and is cached until seed, terrain, density, or output dimensions change. Cursor updates are capped at 30 FPS, stop when settled, and pause when hidden. Errors use typed results, actionable interface messages, and structured logs.

These are synthetic terrain contours, not survey or navigation data. The original proof-of-concept requirements are recorded in `PRD.md`.
