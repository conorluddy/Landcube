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

1. Open **[Topogra](https://conorluddy.github.io/Topogra/)**. The studio starts in **3D** on **Errigal**, loaded as real terrain from tiles bundled with the site, so the first view needs no tile downloads. Browsers without WebGL 2 fall back to 2D. A shared style link opens the 2D design it encodes instead.
2. In **Terrain**, choose another preset or enter coordinates, set the **Area span** slider (2–200 km), then select **Load terrain**. Select **Procedural** in the header for synthetic landscapes: adjust generated scale and detail, select **New landscape**, or lock the seed to retain a landscape while styling it. Select **Coordinates** to restore the last loaded place instantly. Presets set a suggested span that you can adjust before loading, and downloaded elevation tiles are cached in the browser.
3. Use **Contours** for density or real-terrain meter intervals, line appearance and index contours. **Colour** contains canvas colour and palette presets. Palette presets also change contour colours and weights.
4. Switch directly between **2D / 3D** in the header. **Scene** contains cursor interaction in 2D and lighting, floor, surface visibility and water presentation in 3D. Lighting is driven by a **Time of day** slider that sets sun height, colour and studio tint, from golden hour to moonlit night, with direction, intensity, fill, **Flat light** and **Haze** alongside. **Camera**, available in 3D, contains the lens (perspective or orthographic, and a 14–300 mm focal length that keeps the terrain framed while changing perspective), focus effects (**Tilt-shift** or **Depth of field** with f-stop aperture and click-to-pick focus) and exposure. **Model**, available in 3D, contains crop, physical dimensions and terrain shape.
5. Use the footer's **Overlays** shortcut for grids, summit markers, sea-level hatching and geographic decorations. **Orbit**, available in 3D, contains Plan, Isometric, Oblique and Hero view presets, auto-rotate with speed and direction, and reset. Double-click the terrain to orbit around that point. **▶ Tour** plays or pauses the preset-location tour (also under **Terrain → Autoplay**). These tools remain accessible when controls are collapsed.
6. Open **Export** for settled **2D image** SVG/PNG output, dimensions, resolution and transparency. In 3D it also offers a **3D still**, a PNG of the current view at 1×, 2× or 4× its on-screen size with real-terrain attribution, plus **STL model** output and companion attribution. 2D image export always uses the 2D artwork, excluding cursor deformation and the 3D scene.
7. **Copy style link** preserves shared design settings and the generated seed. Real locations, model setup and 3D appearance remain session-only. Local project saving and user presets are not yet available.

Desktop controls live in a collapsible inspector beside the viewport. On mobile, the inspector becomes a scrollable bottom sheet. View selection and export stay in the thin header, with viewport tools and feedback in the footer. Switching views retains settings and restores the last editing section used in that view.

3D starts with **Materials → Natural landscape**: a moss, soil and rock surface with layered earth along the cut edges. Shallow soil horizons follow the terrain; deeper rock beds bend more gently. The procedural grain catches the existing lighting and stays attached as you orbit. **Colour → Land → Land finish → Natural** applies just the land treatment; **Use natural palette** keeps the original earthy colors, or disable it to choose a **Surface tint**. Materials are session-only and do not change SVG/PNG exports, shared links or STL geometry.

Under **Colour → Elevation gradient** in the 3D view, enable **Color by elevation** to color the landscape from low to high. Choose **Paper & ink**, **Sandstone**, **Ember & slate**, **Copper & cream**, or **Coastal**; edit two to six color stops and their percentage positions, add/remove intermediate stops, or reverse the palette. **Soft** blends between stops; **Hard** makes solid bands with boundaries halfway between the color anchors. Colors remain anchored to the source landscape when cropping and follow the actual shelf elevations in Terraced mode. The gradient replaces the land palette while preserving the selected finish's relief and sheen. Disable it to restore the original material colors. Gradient choices are session-only and do not alter STL geometry, 2D exports, or shared links.

Choose **Model → Shape → Terrain shape → Terraced** for flat shelves and vertical risers, like stacked contour sheets. Steps follow the current contour interval: real locations use their Auto or Fixed meter interval; generated landscapes use Density. **Layer height** shows the resulting thickness in millimeters after model sizing and height exaggeration. Terraces use real mesh geometry, cast stepped shadows, and are included in STL exports. Rectangular and circular crops are supported. Terrain shape and contour treatment are independent: hide Contour lines to let the step edges define the landscape, or add drawn/engraved contours. Smooth remains the default; switching back restores the original geometry. These 3D choices are session-only and leave 2D exports unchanged.

Under **Contours → 3D contours → Treatment**, switch from **Drawn** to **Engraved** to preview shallow V-shaped contour grooves. Adjust **Groove width** (0.1–3 mm) and **Groove depth** (0–1 mm) relative to the model dimensions. Index contours have a wider cut; engraved lines are continuous. Natural, Matte and Satin finishes all respond to the groove lighting. The Contour lines toggle hides either treatment; hiding the surface restores floating drawn contours. This is a shading prototype only: STL geometry, 2D exports and saved links remain unchanged.

In 3D, **Model → Model dimensions** sets independent width and length in millimeters (default **150 × 150 mm**) and minimum base thickness below the lowest valley (default **3 mm**). Terrain is cropped without stretching; use the top-down **Crop** preview to choose the area. The source frame is captured when 3D is first enabled, so resizing the browser does not change the model. Height exaggeration affects relief above the base; the overall height is displayed separately.

**Export → Download STL** exports the settled terrain as a closed solid with a flat bottom at Z=0. Import it into your slicer in **millimeters**. The STL includes the base even when hidden in the preview; contours, water, colors, and lighting are omitted. Real-terrain models display source credits and offer **Download attribution** for a companion text file. Browser model settings are session-only, shared links retain the 2D design, and the CLI continues to export SVG/PNG.

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

Real locations now default to **Auto** contour intervals: readable steps in meters chosen from the loaded area's elevation range, anchored to 0 m. Under **Location → Contour interval**, choose **Fixed interval** to enter 1–5000 m. Cropping, orbiting, resizing, and 3D height exaggeration preserve those levels. The interval appears in Location, the 3D controls, and beside the floor scale. **Every N levels** in Settings controls index spacing using actual elevations; for example, every fifth 25 m contour marks multiples of 125 m. Synthetic landscapes retain the Density control; it is disabled while real terrain is active.

CLI real-terrain commands default to `--contour-interval auto`. Set `--contour-interval 25` for a fixed 25 m interval, or `--contour-interval density` for the previous decorative density behavior. Saved configurations preserve the choice; older configurations without this field keep their original density behavior. Very fine intervals that exceed 2048 levels are rejected with a suggested minimum. Browser locations and their interval choices remain session-only; version-one design links are unchanged. SVG contours include the resolved `data-contour-interval-m` attribute.

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
- Contours and grids are decorative artwork, not survey or navigation data. Real-terrain contours use meter intervals when Auto or Fixed is selected; decorative grids are not geographic coordinate grids.

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

The React studio UI lives in `src/studio/`: shared fields and panels read typed controller snapshots, while a renderer adapter handles lazy WebGL activation. Shared design settings and version-one URL serialization remain independent of the UI. Model geometry and scene appearance are separate state domains so future project saving, presets and printable parts can extend the editor without changing the terrain pipeline.

For development: `npm install`, then `npm run dev`. Use `npm run check` for source checks, tests, production builds, and package validation; `npm run test:e2e` runs browser journeys with Google Chrome. The [GitHub Actions workflow](https://github.com/conorluddy/Topogra/blob/main/.github/workflows/build.yml) defines deployment and npm publishing.

Location presets include Reine in Lofoten, Ibiza and Es Vedrà, Cape Town, Uluru (Ayers Rock), Kata Tjuta, coastal Rio, Jamaica’s Blue Mountains, Dubrovnik, Makhachkala, Sulak Canyon, the Mach Loop low-flying valleys in Wales, Pikes Peak in Colorado, and landmark calderas, canyons, fjords and karst such as Santorini, Crater Lake, the Grand Canyon, Geirangerfjord and Guilin. Suggested crop sizes range from 4 km for Es Vedrà to 55 km for Ibiza; these are starting compositions rather than guaranteed shoreline or feature boundaries. CLI `--terrain-preset` uses the same suggested span unless overridden with `--span-km`. Existing presets retain their 25 km default.

The Irish mountain collection includes Carrauntoohil, Croagh Patrick, Benbulben, Errigal, Slieve Donard, Great Sugar Loaf, Lugnaquilla, Mount Brandon, Galtymore, and Diamond Hill. A separate **MacGillycuddy’s Reeks** preset uses a 12 km frame centered across the main summit group; **Carrauntoohil** uses a tighter 6 km frame. All suggested spans remain editable.

In 3D, **Studio floor** presents the solid base inside an enclosing studio box, defaulting to RGB 180 grey (`#b4b4b4`), with directional cast shadows and a subtle contact shadow. The surrounding background follows the floor color, so orbiting never reveals a differently colored sky. Choose a custom floor color or enable **Match canvas**. It is enabled by default and appears when both the land surface and solid base are visible. Ground and shadow are presentation elements and are excluded from STL downloads.

The **Model → Crop** controls in 3D support **Rectangle** and **Circle**. Circle begins at the largest diameter that fits the source frame. Drag inside the outline to reposition the crop, drag a handle to resize it, or use the **Crop size** slider. **Reset crop** restores the largest centered crop. When the preview is focused, arrow keys move the crop (Shift moves faster), +/− resize it, and Home resets it. Circle uses a **Diameter (mm)** control instead of width/length; changing the selected area changes which terrain fills that physical diameter. The 3D surface, base, contour and water layers follow the crop, and STL exports contain the same closed shape. Crop choices are session-only and leave 2D exports unchanged.

Lighting starts at **35° elevation** with **0.7 fill** to bring out the natural textures. Direction uses compass bearings (0° north, 90° east). When a real location is loaded, a sunrise-side artistic suggestion uses 120° in the northern hemisphere, 60° in the southern hemisphere, or 90° near the equator. It does not calculate solar position from time/date. Manual direction changes are retained across location changes; **Reset lighting** restores the suggestion for the current location. Sun/Moon cast shadows; Off or zero intensity removes the directional floor shadow.
