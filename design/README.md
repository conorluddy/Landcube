# Handoff: LANDCU.BE design system (HUD / frosted glass)

## Overview

A monochrome "surgical planning" design system for **LANDCU.BE** (repo: `conorluddy/Topogra`). Floating dark frosted-glass panels over a full-bleed terrain canvas, hairline borders, small tight type, all-caps tracked monospace labels, numbered section codes. It covers the desktop studio, the mobile app (21 screens), and a set of feature experiments.

The terrain canvas itself is out of scope — keep the existing renderer. The monochrome UI is meant to sit around a full-colour terrain view.

## About the design files

Everything in `reference/` is a **design reference built in HTML**. These are prototypes that show the intended look and behaviour; they are not production code to copy. Recreate them in the existing app: React + TypeScript in `src/studio/`, with styles currently in `src/landscape-studio.css`. Follow that codebase's patterns. The only file meant to be used directly is **`tokens.css`**.

Open the reference HTML files in a browser. They work offline as long as `reference/assets/` sits next to them.

| File                                   | What it is                                                                                                                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tokens.css`                           | **Use directly.** All design tokens as CSS custom properties (`--lc-*`). Dark theme by default; `[data-theme="light"]` is provisional.                                                              |
| `reference/0-component-inventory.html` | All 73 items (foundations, primitives, composites, overlays, templates), each with variants, states, sizes, the screens it's used on, and a live sample for most. **Start here.**                   |
| `reference/1-desktop-studio.html`      | Desktop studio: interactive inspector, cursor crosshair.                                                                                                                                            |
| `reference/2-experiments.html`         | 2a light theme · 2b collapsible/detachable panels · 2c command palette · 2d map overlays · 2e model dossier · 2f loading/empty/fault · 2g mobile first pass · 2h presets + A/B wipe · 2i GPX route. |
| `reference/3-mobile.html`              | 3a–3u mobile screens in five flows, plus the 3z part list.                                                                                                                                          |

## Fidelity

**High fidelity** for desktop and mobile: final colours, type, spacing and control styling. Recreate them pixel-accurately. The experiments (2a–2i) are **directional**: the visual language is final, but the features are proposals.

Decided:

- The product name is **LANDCU.BE** everywhere.
- **Keep the current text sizes**, including 8.5px mono on desktop and 9px on mobile.

## Core rules

1. **Two typefaces, one rule.** Geist (300/400/500) for words a person reads: labels, titles, hints. Geist Mono (400/500) for anything a machine would print: values, coordinates, codes, buttons, tabs, caps labels. Mono caps are always tracked (`--lc-track-*`); Geist is never tracked.
2. **Monochrome only.** Colour appears only as data (material swatches, colour ramps) and as the optional signal accent on status marks.
3. **Hairlines, not fills.** Every border is 1px. Selection is shown by a bone border or a bone fill, never by a colour.
4. **Glass is the only surface.** Every panel is `--lc-glass-*` with `backdrop-filter: var(--lc-glass-filter)`, a `--lc-line-panel` border, radius `--lc-r-panel` (3px) and a `--lc-shadow-*` shadow.
5. **Numbered codes.** Sections are numbered 01–07 with 4-letter codes (TERR, CONT, COLR, CAMR, SCEN, MODL, FRAM). Groups are coded `CODE.NN` (e.g. `CONT.02`). Errors are coded `E-NNN`.
6. **One primary action per surface.** It is a bone-filled button with ink text.
7. **No pill shapes.** Switches are two-cell OFF/ON; corners are 1–3px (14px only on the top edge of mobile sheets).

## Design tokens

See `tokens.css` for every value. The key ones:

- **Ink ramp:** `#0B0C0D` `#0E0F10` `#141516` `#2A2C2E` `#55585B` `#6D7074` `#8D9094` `#A9ACAF` `#C9CBCD` `#D9DAD7`, bone `#F2F2F0`, white `#FFFFFF` (hover on bone only), canvas `#BCBCBC`.
- **Text roles:**
  - primary: bone
  - strong: ink-9
  - body: ink-8
  - secondary: ink-7
  - tertiary: ink-6
  - quiet: ink-5
  - disabled: ink-4
  - on-bone: ink-1
- **Lines:** white at 0.06 (subtle), 0.10 (default), 0.16 (strong), 0.26 (hover), 0.09 (panel edge); bone for focus.
- **Glass:** `rgba(14,15,16,α)` at α 0.68 (bar), 0.78 (panel), 0.88 (sheet), 0.82 (map tooltip). Blur 24px with saturate(1.3); 12px for small tooltips.
- **Shadows:**
  - bar: `0 18px 40px -16px rgba(0,0,0,.45)`
  - card: `0 24px 48px -16px rgba(0,0,0,.45)`
  - panel: `0 30px 60px -20px rgba(0,0,0,.5)`
- **Radii:** 1 (inner) · 2 (control) · 3 (panel) · 14 (sheet top).
- **Spacing:** 2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 24. **12px is the layout unit**: the inset of panels from the viewport edge, and the snap grid for detached panels.
- **Heights:** 22 (switch) · 28 (select / secondary button) · 30 (field / primary button) · 40 (top bar; the footer is 36) · 44 (mobile minimum hit target) · 52 (mobile primary CTA).
- **Desktop type:** 8.5 micro · 9 label · 10 UI · 10.5 slider value · 11 hint · 11.5 value · 12 body · 15 inspector title · 22 card title (weight 300).
- **Mobile type:** 9 · 10.5 · 11 · 13 · 14 · 16 (inputs, to prevent iOS zoom) · 18 · 20 · 28 (page title, weight 300).
- **Tracking (mono caps):**
  - coordinates: 0.06em
  - UI: 0.12em
  - labels: 0.14em
  - group headers: 0.16em
  - brand: 0.22em
- **Signal accent:** bone (default) · amber `#FF6A13` · phosphor `#C6FF3D`. Used on status dots only.

## Primitives (exact specs)

All values below are desktop unless marked "mobile".

- **Button / primary:**
  - Bone fill, ink-1 text, Mono 10px weight 500, tracking 0.14em, caps, radius 2px.
  - Height 30px, padding 0 12–14px, optional trailing glyph (→ ↗ ↓ ↵) with a 10px gap.
  - Hover: fill `#FFF`. Mobile: height 48–52px, padding 0 16–18px, label 11px.
- **Button / secondary:**
  - Transparent, border `--lc-line-strong`, text ink-9, Mono 10px, tracking 0.14em, height 28px, radius 2px.
  - Hover: bone border, `#FFF` text. Mobile: height 44–48px.
- **Button / text:** Mono 10–10.5px caps, tracking 0.12–0.14em, ink-7. Hover: bone. Used for CANCEL, RESET, REPLACE, KEEP AS IS.
- **Icon button (mobile):** 44×44px, glass fill with a `--lc-line` border, radius 3px, 15px glyph. Active state: bone fill, ink text.
- **Segmented control:**
  - Container: 3px padding, 2px gap, a `--lc-line` border (on glass bars the container is itself a glass pill), radius 3px.
  - Items: Mono 10px, tracking 0.12em, radius 2px. Selected: bone fill, ink-1 text. Unselected: transparent, `#9A9DA1` text; hover gives a bone text with a `--lc-fill-hover` fill.
  - Desktop height = bar height − 6px. Mobile items are 36–40px.
- **Switch (OFF/ON):**
  - Two cells inside a 2px-padded box with a `--lc-line` border, radius 2px, Mono 8.5px, tracking 0.1em, cell padding 3px 6px.
  - On: the ON cell is bone with ink text; OFF is ink-4. Off: the OFF cell is `--lc-fill-off` with ink-9 text; ON is ink-4.
  - Row: label in Geist 12px ink-8, switch right-aligned, minimum height 22px.
- **Ruler slider:**
  - Header row: label (Geist 12px ink-8) on the left; value (Mono 10.5px bone, tabular-nums) plus unit (ink-5, 4px gap) on the right.
  - Track: 16px tall. Rail is 1px at y=7, line 0.14. Ticks: `--lc-ticks`, 4px tall at y=10, one every 10%. The filled run is a 1px bone line.
  - Thumb: 7×13px bone, radius 1px, `--lc-ring-thumb`.
  - Hit area: an invisible native `<input type=range>` 24px tall.
  - Mobile: 36px track, 10×24px thumb, 6px ticks, 3px ring.
- **Select (cycle):**
  - 28px tall, minimum width 150px, padding 0 9px, `--lc-line` border, `--lc-fill-field` fill, radius 2px.
  - Value in Geist 12px; position `01/03` in Mono 9px ink-6 on the right. Hover border: `--lc-line-hover`.
  - A real dropdown/picker is not yet designed.
- **Field:** 30px tall, padding 0 9px, `--lc-line` border, `--lc-fill-field` fill, radius 2px, Mono 11.5px. Focus: bone border.
  - Label above (6px gap): Geist 12px ink-8, with the unit right-aligned in Mono 9px ink-5 caps.
  - Paired fields sit in a 2-column grid with an 8px gap. Empty placeholder: "—".
- **Search field:**
  - Glass pill, 40px tall: a `LOC` prefix (Mono 9px ink-5, tracking 0.14em), the input (Geist 12px), and a kbd hint.
  - Mobile: 46px tall, 16px text, bone border while focused.
- **Colour field:** hex in Mono 10px ink-6, then an 8px gap, then a 22×14px swatch with a white 0.2 border.
- **Choice tile:**
  - Laid out in a 3-column grid with a 4px gap. Minimum height 32px, padding 6px 8px, Geist 11px, radius 2px.
  - Selected: bone border + `--lc-fill-selected` fill. Unselected: `--lc-line` border, ink-7 text; hover gives a 0.28 border.
  - Optional 10×10px swatch.
- **Value chip:** padding 10px 12px, Mono 10px, radius 3px. Selected and unselected states follow the choice tile.
- **Checkbox:** 18×18px. On: bone fill with an ink ✓. Off: a 0.25 border.
- **Kbd hint:** Mono 9px ink-6, padding 2px 5px, a 0.14 border, radius 2px.
- **Tag:** Mono 8–9.5px caps, tracking 0.1em, padding 2px 5px. Three variants:
  - outline bone (final states: PRINTED, EXPORTED)
  - outline muted (DRAFT)
  - solid bone (A/B labels, file type)
- **Signal mark:** a 6×6px square (5px in the footer) in `--lc-signal`, for OK/live. A diamond is a square rotated 45°: outline for fault, solid for waypoint (10–12px).
- **Progress:** 2px tall; track at white 0.08, fill bone.
- **Group header:** caps label (Mono 9px ink-9, tracking 0.16em), then a flexible 1px hairline at 0.08, then the code (Mono 8.5px ink-4). 10px gaps, 12px margin below.
- **Readout cell:** label (Mono 8.5px ink-5, tracking 0.14em), then a 3px gap, then the value (Mono 11.5px bone, tabular-nums).
- **Brand lockup:** ≋ glyph at 18px, then the wordmark `LANDCU.BE` (Mono 11px weight 500, tracking 0.22em) over a context line (Mono 8.5px ink-6, tracking 0.16em, e.g. `STUDIO`). On the mobile splash the wordmark is 22px with tracking 0.26em.

## Composites

- **Desktop shell:**
  - Separate glass pills at a 12px inset, laid out 12/6px apart: brand · view segmented (2D/3D) · source segmented · location search, then a spacer, then COPY STYLE LINK (secondary) and EXPORT (primary).
  - Inspector at top 60 / right 12 / bottom 60, 396px wide.
  - Footer 36px: a tool group (CONTROLS · OVERLAYS · ORBIT · ▶ TOUR) plus a status line with the attribution.
- **Inspector:** a 92px section rail plus a content column.
  - Rail item: index (Mono 8.5px) over the name (Mono 10px, tracking 0.12em), padding 9px 12px. Active: `--lc-fill-active` with a 2px bone bar on the left edge.
  - Header: `02 / 07` index · title (Geist 15px) · tag on the right (Mono 8.5px ink-5), with padding 16/18/14px and a bottom hairline.
  - Body: scrolls, padding 4px 18px 18px, groups spaced 16px apart, rows 12px apart.
- **Control group row types:** toggle · range · select · number · pair · colour · tiles · hint (Geist 11px ink-6, line-height 1.55) · status · link (Mono 9.5px caps + ↗) · primary button · secondary button.
- **Status message:** padding 9px 10px, a `--lc-line-subtle` border, fill white 0.03. Signal mark, then the code (Mono 9px ink-9, tracking 0.14em) over the text (Geist 11.5px ink-8).
- **Readout card ("Target lock"):** 300px wide, from top to bottom:
  - header: signal + label, with the source on the right
  - name (Geist 22px weight 300) over place (Mono 9.5px ink-6)
  - 2-column readout grid with hairline rows
  - scale bar: 4 alternating segments, 4px tall, bone border, ticks labelled 0 / 1 / 2 KM
- **HUD overlay (canvas):**
  - 18px corner brackets in 1px ink-3.
  - Top tick ruler: 6px tall, a tick every 24px, opacity 0.55.
  - Camera readout (`VIEW 3D · ORBIT  FOV 38°  AZ 312°  EL 34°`, Mono 9px tracking 0.12em) on the left, `GRID 500 M` on the right.
  - Crosshair: full-bleed 1px lines at `rgba(20,21,22,.28)`, plus a coordinate tip in a glass box, offset 12px from the cursor. Hidden while the pointer is over UI.
- **Collapsed / detachable panels (2b):**
  - The inspector collapses to its rail.
  - Any group can be dragged out by its header into a floating glass card, snapping to the 12px grid.
  - A layout manager shows `N PINNED · RESET LAYOUT`.
- **Command palette (2c desktop, 3l mobile):** an input with a ⌘ kbd hint, results grouped under caps headers, and a preview pane.
  - Preview, parameter result: the value diff (`20 M → 25 M`) with a SET VALUE ↵ button.
  - Preview, location result: coordinates.
  - Mobile adds "also matches" rows and a strip of quick-value chips above the keyboard.
- **Mobile studio:** the map is full-bleed; a bottom sheet has three snap heights (peek / half / full).
  - Peek shows readouts and the export button.
  - Half shows the section tab strip plus the controls.
  - Full hides the map controls.
  - Map controls are 44px icon buttons on the right.
- **Mobile tab bar:** 84px tall including the home-indicator area. Four items: LIBRARY ▦ · STUDIO ≋ · PRESETS ◧ · ACCOUNT ○. The glyph is 17px over a Mono 8.5px label; the active item is bone and has a 24×2px bar on its top edge.
- **List row (mobile):** 50–56px tall with a hairline bottom border. A 28px glyph tile, then the title (Geist 15px) over the meta (Mono 9px ink-5), then a trailing value or ›.
- **Model card:** thumbnail 132px tall, then name (Geist 13px) with a status tag, over the meta (Mono 8.5px). Laid out in a 2-column grid with a 10px gap.
- **Mode bar (tools):** a 44px glass bar: CANCEL · TITLE · DONE, with DONE as a primary button.
- **Fault card:**
  - Header: a diamond, then the code (`E-204 · COVERAGE GAP`), with a metric (`44% VOID`) on the right.
  - Body: Geist 14px (mobile).
  - Actions: a full-width primary, then two secondary buttons side by side.
  - On the map, the empty area gets the hatch pattern plus a `NO DATA` tag.
- **Loader:** a tile grid that fills from the centre outwards, a scan-line sweep (1px bone with a glow), and a card with title, percent, tile count, a 2px progress bar and CANCEL.
- **Export flow:**
  - Export sheet: summary, format segmented (STL/3MF/GLB), parts checklist rows with sizes, plaque preview, and a download CTA showing the zip size.
  - Building: one progress row per part (QUEUED → MESHING % → DONE).
  - Ready: a ✓ tile plus hand-off rows (Files, Share, Send to printer, Copy style link).
- **Map overlays:**
  - Crop frame: rectangle or circle, rule-of-thirds lines at bone 0.25, 24px handles with 3px strokes, a dimension label above, and a 50% darkened surround.
  - A/B wipe: a 1px bone divider with a 56×24px bone handle; A and B tags.
  - Route: a 2.5px bone line over a 7px ink halo at 0.5, with diamond waypoints and a label tip.

## Interactions and behaviour

- The section rail and mobile tab strip switch sections. Segmented controls are single-select. Select (cycle) advances on click.
- Sliders update their value live, with tabular-nums so numbers don't jitter.
- The crosshair hides while the pointer is over any UI surface.
- Bottom-sheet snaps:
  - peek: about 190px
  - half: about 50%
  - full: 64px from the top
  - Map controls and the scale bar hide when the sheet is full.
- Narrow desktop: buttons never wrap (`white-space: nowrap`), the search pill shrinks first (minimum 120px), and the readout card hides below 700px of viewport height.
- **Motion:** use the provisional tokens: `--lc-ease`, 120ms (hover), 200ms (state), 320ms (sheet). No bounces.
- **Not yet designed:** disabled and error states, a real dropdown and colour picker, toasts with undo, the indeterminate progress bar, and final light-theme values.

## State to add

- **UI:**
  - `section`
  - `view` (2D/3D)
  - `source` (procedural/coordinates)
  - `sheetSnap` (mobile)
  - `inspectorCollapsed`
  - `pinnedGroups[]` with positions (2b)
  - `paletteOpen`/`query`
  - `toolMode` (crop / presets / route / measure)
  - `theme`
  - `signalAccent`
- **Export:** `format`, `includedParts`, `plaqueText`, `jobs[]` with progress.

## Suggested port order

1. Add `tokens.css`, then rewrite `src/landscape-studio.css` against the `--lc-*` variables. The look shouldn't change at this step.
2. Build the primitives in `src/ui/` (Button, Segmented, Switch, RulerSlider, Select, Field, SearchField, ColorField, ChoiceTile, Chip, Checkbox, Kbd, Tag, SignalMark, Progress, GroupHeader, Readout, BrandLockup). Add a dev-only `/specimens` route that shows every variant × state.
3. Composites: GlassPanel, FloatingBar, Inspector + SectionRail, ControlGroup (with typed row configs, mirroring the section data in `src/studio/app.tsx`), StatusMessage, ReadoutCard.
4. Migrate the inspector one section at a time, Terrain first.
5. Then the HUD overlays, the command palette, and the mobile shell (bottom sheet, tab bar).

## Assets

- **Fonts:** Geist and Geist Mono (Google Fonts, or the `geist` npm package).
- **Glyphs:** Unicode (≋ ▲ ◎ ◢ ≈ ⌖ ◆ ▦ ◧ ○ ↗ → ↓ ⇕ ✓ ⌘ ›). Open question: keep these, or draw a 16px icon set? Rendering varies by OS.
- `reference/assets/terrain-16.42.18.png` is a greyscale screenshot of the existing renderer, used only as a stand-in for the canvas.
