# Topogra

Topogra creates topographic artwork from generated landscapes or real-world elevation data. Design backgrounds for websites, presentations, and print in the browser, ask an agent to generate them, or export reproducible SVG and PNG assets from the command line.

**[Open the web app](https://conorluddy.github.io/Topogra/)** · [Install agent plugins](#install-agent-plugins) · [Use with an agent](#use-with-an-agent) · [Use with NPX](#use-with-npx)

<img width="1512" height="830" alt="Topogra browser editor showing topographic artwork and style controls" src="https://github.com/user-attachments/assets/6bb628c7-cc4b-424b-a004-409b6e4c09ef" />

## Features

- **Generated or real terrain.** Explore seeded landscapes, choose a real-world location preset, or enter coordinates and an area span.
- **Your own visual style.** Start with Charcoal, Paper, Blueprint, Bold, or a random palette; adjust colours, line weight, opacity, terrain scale, detail, and contour density.
- **Map-inspired details.** Add dashed or solid index contours, square or cross grids, and triangular or cross-shaped summit markers.
- **Interactive landscapes.** Move the cursor to raise a hill or create a depression in generated terrain.
- **Ready-to-use exports.** Download standalone SVG or PNG files with custom dimensions, transparent backgrounds, and 1× or 2× PNG resolution.
- **Reproducible designs.** Reuse a seed, share a browser design link, or save a versioned CLI configuration for later generation.

No account or backend is needed. Generated landscapes run offline once the web app has loaded; real terrain downloads public elevation tiles without an API key.

## Use the web app

1. Open **[Topogra](https://conorluddy.github.io/Topogra/)** and choose a palette. Adjust density, scale, and detail, or select **New landscape** to explore another seed.
2. For a geographic landscape, open **Real terrain**, choose a preset or enter latitude, longitude, and an area span of 2–200 km, then select **Load terrain**. **Use generated** returns to synthetic landscapes.
3. Adjust contour styling, grids, and summit markers. Lock the seed to keep your generated landscape while experimenting with its appearance.
4. Open **Export**, choose SVG or PNG, set dimensions and transparency, and download. The preview shows the complete output; exported artwork uses settled terrain without the cursor effect.
5. Use **Copy link** to share the current design. Reloading the link restores the saved styling and generated seed.

The **3D** tab between Settings and Export contains the experimental raised-contour preview, height exaggeration, a matte surface with its own color picker, adjustable light direction, elevation, intensity and fill, auto-rotation, and camera reset. Switching tabs preserves the current view; 3D controls are session-only and exports remain 2D.

Real terrain is centered and cropped without stretching. Cursor deformation is available only for generated terrain; scale and detail also apply to generated terrain.

## Use with an agent

Ask for the image you want and where to save it. The skill generates an image and a matching JSON configuration for reproducible exports.

Then ask, for example:

> Use Topogra to create a transparent Blueprint contour background at 1920 × 1080 as an SVG. Save it and its reproducible configuration in public/assets/.

Or request a real location:

> Use Topogra to create a Paper-style PNG of the Wicklow Mountains for a presentation. Save the image, configuration, and attribution text in assets/.

The skill saves and validates the configuration, reports the output paths and generation command, and includes a companion credit file for real terrain.

### Other agentic examples:

1. Website hero backgrounds

   “Create a subtle charcoal contour SVG for a hiking brand’s homepage, with enough contrast for white text.”

2. Presentation backgrounds

   “Generate a light Paper-style terrain background for a 16:9 slide deck that won’t compete with charts.”

3. Location-specific event artwork

   “Use Wicklow Mountains terrain for a trail-running event poster, and save the source attribution.”

4. App onboarding illustrations

   “Create three coordinated terrain backgrounds using different seeds and our brand colours.”

5. Product packaging

   “Generate a monochrome contour pattern for a coffee bag inspired by the region where the beans grow.”

6. Social media campaigns

   “Export matching square, portrait, and landscape terrain artwork for an outdoor gear launch.”

7. Developer documentation branding

   “Add a transparent Blueprint contour SVG to the docs site’s header and save its configuration alongside the asset.”

8. Personalized prints

   “Create minimalist contour artwork centered on Mount Fuji, sized for a portrait print.”

9. Game and dashboard interface textures

   “Generate a faint green contour overlay for a mission briefing screen, with a cross grid and transparent background.”

10. Repeatable asset generation in a codebase

    “Create backgrounds for each destination page from its coordinates, using consistent styling and a saved configuration per location.”

## Use with NPX

Requires Node.js 20.19+, 22.13+, or 24+. Run the published CLI without installing it globally:

```sh
npx --yes topogra generate --palette Blueprint --seed 42 \
  --width 1920 --height 1080 --output background.svg \
  --save-config background.json
```

Regenerate the saved design, or export it as PNG:

```sh
npx --yes topogra generate --config background.json --output copy.svg
npx --yes topogra generate --config background.json \
  --format png --png-scale 2 --output background.png
```

Generate real terrain using a named location:

```sh
npx --yes topogra generate --terrain-preset "Wicklow Mountains" \
  --span-km 25 --palette Paper --output wicklow.svg \
  --save-config wicklow.json --attribution-file wicklow-attribution.txt
```

New real-terrain designs default to `--max-depth 0`, flattening elevations below sea level. Use `--max-depth 100` to include depths down to 100 m (supported range: 0–11000 m). The browser provides a **Maximum depth below sea level (m)** control, defaulting to 20 m. **Sea-level hatching** marks terrain at or below 0 m in both 2D and the experimental 3D view, and is included in 2D exports. It indicates elevation, including inland depressions, rather than identifying water; the browser toggle is session-only. Saved CLI configurations retain the limit; older configurations without it keep their original unrestricted bathymetry.

Coastal tiles combine land elevation and bathymetry and can contain stepped source boundaries. Use an explicit elevation floor to omit affected low elevations, for example:

```sh
npx --yes topogra generate --terrain real --latitude 54.651738 --longitude=-8.707332 --span-km 8 --elevation-floor 250 --palette Paper --format png --size 2560x1440 --output slieve-league.png --save-config slieve-league.json --attribution-file slieve-league-attribution.txt
```

`--elevation-floor` clips source elevations before normalization. It removes low terrain rather than reconstructing a shoreline, and is saved in the CLI terrain configuration. The browser has the same optional **Elevation floor (m)** control. Omit it to retain all terrain above the selected depth limit. Inspect coastal output before publishing; a cutoff suitable for one location may not suit another.

Discover palettes, output sizes, locations, and all design flags:

```sh
npx --yes topogra presets --json true
npx --yes topogra --help --verbose
npx --yes topogra validate --config background.json
```

Every design setting has a kebab-case flag, such as `--transparent true` or `--grid-style crosses`. Palette names are case-sensitive. Settings apply in this order: defaults, configuration or browser URL, palette/size, then explicit flags. Use `--url 'COPIED_DESIGN_URL'` instead of `--config` to start from a browser design.

Existing output files require `--force true` to replace. For automation, `--json true` returns structured generation metadata; `--output -` writes image bytes to stdout and cannot be combined with JSON output. You can also install globally with `npm install --global topogra` and run `topogra` directly.

## Sharing and output details

- Browser links preserve design settings and generated seeds, but **do not restore real-terrain locations**. Save a CLI configuration to preserve terrain settings for regeneration. Seed locking is local to the browser.
- Exports support 64–4096 px per side by default. Extra-large exports raise the limit to 12,288 px per side; final PNG dimensions, including 2× scaling, must fit the selected limit. Large raster exports can use substantial memory.
- Real-terrain exports visibly include resolved source attribution. A companion credit file supports downstream layouts; keep the credit visible in the final published medium where reasonable.
- Contours and grids are decorative artwork, not survey or navigation data. Real-terrain density uses a normalized elevation range, and decorative grids are not geographic coordinate grids.

## Install agent plugins

Topogra supports Codex and Claude Code marketplaces. Both plugins bundle the same [Topogra agent skill](https://github.com/conorluddy/Topogra/blob/main/skills/topogra/SKILL.md), which runs the published CLI through NPX. You need Node.js 20.19+, 22.13+, or 24+ and npm; no repository checkout, global Topogra installation, or Topogra account is required.

### Codex

Add the marketplace and install the plugin with a Codex CLI that supports plugins:

```sh
codex plugin marketplace add conorluddy/Topogra
codex plugin add topogra@topogra
```

Alternatively, add `conorluddy/Topogra` in Codex's plugin marketplace picker, then install **Topogra** from that marketplace. Start a new conversation and ask the agent to use Topogra.

### Claude Code

Add the marketplace and install the plugin:

```sh
claude plugin marketplace add conorluddy/Topogra
claude plugin install topogra@topogra
```

Start a new conversation, then invoke the skill with your brief:

```text
/topogra:topogra Create a transparent Blueprint SVG at 1920 × 1080 in public/assets/.
```

You can also ask Claude to use Topogra in natural language.

### Install only the skill

Copy the repository's `skills/topogra/` directory into your agent's skills directory:

| Agent       | Destination                 |
| ----------- | --------------------------- |
| Codex       | `~/.codex/skills/topogra/`  |
| Claude Code | `~/.claude/skills/topogra/` |

Start a new conversation after copying. For testing a local marketplace checkout, run `codex plugin marketplace add .` or `claude plugin marketplace add .` from the repository instead of adding the GitHub source, then use the corresponding install command above.

---

For development: `npm install`, then `npm run dev`. Use `npm run check` for source checks, tests, production builds, and package validation; `npm run test:e2e` runs browser journeys with Google Chrome. The [GitHub Actions workflow](https://github.com/conorluddy/Topogra/blob/main/.github/workflows/build.yml) defines deployment and npm publishing.
