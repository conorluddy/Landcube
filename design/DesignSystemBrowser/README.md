# Handoff: LANDCU.BE system mode

## Overview

A **design-system mode** inside the running app at landcu.be. A footer link switches the studio into a living specimen book:

- The three.js canvas is replaced by a light-grey drafting grid with every component laid out on it.
- The inspector flips over and becomes the system's navigation.
- One click flips everything back.

The page is a portfolio piece as well as a reference, so the specimens are the **real components**, not pictures of them.

Builds on the earlier handoff `design_handoff_landcube_design_system/`, which has the full spec, tokens and primitive measurements. This README covers only what's new: the mode, its shell, the flip, the specimen stage and the registry.

## About the design files

`reference/system-mode.html` is a **design reference built in HTML**, a working prototype of the intended look and behaviour. It is not production code to copy.

Recreate it in the existing app: React + TypeScript in `src/studio/`, with styles against the `--lc-*` tokens. Specimens must render the actual `src/ui/` primitives and composites, so the page can never drift from the product. `reference/registry.js` is lifted from the prototype as a data starting point and can be ported to TypeScript almost as-is.

## Fidelity

**High fidelity.** Final colours, type, spacing, glass, motion and copy. Recreate it pixel-accurately.

Exceptions:

- Cards labelled "NOT YET DESIGNED" are deliberate placeholders. Keep them as placeholders until those parts are designed.
- Motion values are still provisional.

## Files

| File                         | What it is                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `reference/system-mode.html` | Self-contained offline prototype. Open it in a browser; it starts in system mode. Use the footer link or `← BACK TO STUDIO` to flip. |
| `reference/registry.js`      | The specimen registry: `CATS` (5 sections) and `ITEMS` (47 parts) with descriptions, specimen cells and spec rows.                   |
| `tokens.css`                 | Same token file as the previous handoff. Included so this folder stands alone.                                                       |

## Entry and exit

- **Studio → system:**
  - Main route: a footer status-line button, `DESIGN SYSTEM ◧`. Mono 9px, tracking 0.12em, bone text; hover underlines it. It sits immediately left of `GITHUB ↗`.
  - Optional deep link: `?mode=system` or `/system`, so the portfolio can link straight in. Also accept `&part=PRIM.04`.
- **System → studio:** any of these:
  - the footer button, now reading `↩ STUDIO`
  - the top-bar secondary button `← BACK TO STUDIO`
  - `Esc` while no input is focused (suggested, not in the prototype)
- Studio state (section, slider values, view, source) is preserved across the round trip. Only `mode` changes.
- **Don't unmount the three.js renderer.** Pause its render loop and fade the canvas to opacity 0, so the return trip is instant.

## The flip transition

Total duration about 560ms. Every step is driven by timers, never by `requestAnimationFrame` chains. rAF stalls in background or throttled tabs, and the panel then stuck edge-on.

1. **t=0:**
   - The inspector `aside` animates `transform: perspective(1800px) rotateY(0 → 90deg)` over 260ms with `cubic-bezier(0.5,0,0.9,0.4)` (ease-in).
   - At the same moment, the canvas layers cross-fade over 600ms with `--lc-ease`: terrain opacity 1→0, grid ground 0→1. The direction reverses on the way back.
   - A scan line sweeps the stage once from left to right: 1px bone, `box-shadow: 0 0 14px 3px rgba(242,242,240,.55)`, 640ms `--lc-ease`. Its opacity goes 0 → 1 (by 12%) → 0. It's clipped to the area left of the inspector (`right: 408px`).
2. **t=260ms:** swap the panel contents, the header pills and the footer contents. Set `rotateY(-90deg)` with no transition.
3. **t=290ms:** animate to `rotateY(0)` over 300ms with `--lc-ease`.
4. **t=700ms:** a safety timeout forces `rotateY(0)` and clears the busy lock. Ignore toggles while the lock is held.

- **`prefers-reduced-motion`:** skip the rotation and scan line, and keep a 200ms cross-fade. The prototype's `transition: Instant` tweak shows the no-motion behaviour.

`backdrop-filter` survives because the transform sits on the glass element itself. Don't wrap it in a `preserve-3d` parent; that kills the blur in Chromium.

## Layout (system mode)

The shell geometry is identical to the studio: same insets, same panel sizes. Only the contents change.

### Ground (replaces the canvas)

- `#BCBCBC` (`--lc-canvas`) with two grid layers:
  - minor: 1px `rgba(42,44,46,0.07)` every 12px
  - major: 1px `rgba(42,44,46,0.16)` every 120px
  - `background-position: 12px 12px`, so the grid aligns to the 12px panel inset
- The HUD stays:
  - corner brackets and the top tick ruler, as in the studio
  - the camera readout is replaced by a bottom-left line, `SPECIMEN PRIM.04  SCALE 1:1  03 PLATES` (Mono 9px, 0.12em, ink-3)
  - `GRID 12 PX` sits bottom-right, 448px from the right edge
- The crosshair stays, but its tip reads `X 0412 PX` / `Y 0218 PX` (padded to 4 digits) instead of lat/lon. It hides over any glass surface, including specimen cards (`[data-glass]` in the prototype).

### Top bar (left → right, 6px gaps, 40px tall)

1. **Brand pill:** `flex-shrink:0; white-space:nowrap`. The context line changes from `STUDIO` to `SYSTEM · REV A`.
2. **Breadcrumb pill:** padding 0 14px, Mono 10px, tracking 0.12em, no wrap. Contents: `PRIM` (ink-6), `/` (ink-4), `PRIM.04` (bone), `RULER SLIDER` (ink-9), 10px gaps.
3. **Find pill:**

- Same as the LOC search pill: 300px wide, shrinks to a 120px minimum.
- Prefix `FIND`. Placeholder "Slider, glass, ink-6…".
- The trailing kbd shows `⌘F` when empty, or the zero-padded match count (`04`) while searching.

4. Spacer.
5. **Secondary:** `← BACK TO STUDIO`, glass-bar style, same as `COPY STYLE LINK`.
6. **Primary:** `SOURCE ↗`, bone fill, linking to https://github.com/conorluddy/Landcube.

### Inspector, flipped (396px, top 60 / right 12 / bottom 60)

- **Rail (92px):** five items, using the same rail item component.

  | Index | Code | Section      |
  | ----- | ---- | ------------ |
  | 01    | FNDN | Foundations  |
  | 02    | PRIM | Primitives   |
  | 03    | COMP | Composites   |
  | 04    | OVLY | Map overlays |
  | 05    | LYOT | Layouts      |

  The rail footer reads `↑ ↓` / `BROWSE` (Mono 8.5px, ink-4).

- **Header:** `02 / 05` · section name (Geist 15px) · on the right, `17 PARTS`. While searching it reads `FIND` · `Results` · `4 MATCHES`.
- **Body:** the part list, grouped by `grp`.
  - Each group uses the standard group header: caps title, then a hairline, then a zero-padded count. 6px below.
  - **Part row:**
    - Full-bleed: −18px side margins, 18px padding.
    - Grid `62px | 1fr | auto`, 8px gap, padding 8px 18px.
    - Columns: code (Mono 8.5px, 0.1em, ink-4), name (Geist 12px, ink-8), plate count (Mono 8.5px, ink-4).
    - Hover: fill white 0.03, name bone.
    - Active: fill `--lc-fill-active`, 2px bone bar on the left edge (inset 5px top and bottom), code ink-7, count ink-6, name bone.
  - While searching, results are grouped by section instead. With no hits: "No parts match “q”." in hint style.
  - **Footer group `OPEN · REV B`:** a status message with an outlined diamond mark. Code `NOT YET DESIGNED`, then the text: "Disabled and error states, dropdown, colour picker, toasts, light theme values. Motion is provisional."

### Specimen stage

- **Position:** left 12 / top 60 / right 420 / bottom 60. Scrolls vertically, with a thin scrollbar (`rgba(14,15,16,.3)` thumb).
- **Content:** padding 56px 44px 64px, a vertical stack with a 28px gap.
- **On part change:** fade out (opacity to 0 over 140ms), swap, reset `scrollTop` to 0, fade in over 260ms `--lc-ease`.

#### 1. Title block (printed on the ground in ink, no panel), max-width 720

- **Code line:** Mono 9px, tracking 0.16em, ink-3. Reads `PRIM.04 / PRIMITIVES / INPUTS`, with the code itself in ink-1.
- **Title:** Geist 34px, weight 300, tracking −0.01em, ink-1.
- **Summary:** Geist 13px, line-height 1.55, ink-3, max-width 560, `text-wrap: pretty`.
- **Tags:** Mono 8.5px, tracking 0.12em, padding 3px 6px, radius 2px, 6px gap:
  - `03 PLATES`: outline, 1px ink-3
  - `USED IN 1 · 3F · 3G`: outline, 1px ink-3
  - source path (`SRC/UI/RULERSLIDER`): solid ink-1 with bone text

#### 2. Section rule `SPECIMENS`

Mono 9px, tracking 0.16em, ink-3, then a hairline `rgba(42,44,46,.35)`, then `PRIM.04.A`.

#### 3. Plates

- Flex-wrap, 12px gap, `align-items: stretch`.
- Each plate is a glass card:
  - `--lc-glass-panel` with `--lc-glass-filter`
  - `--lc-line-panel` border, 3px radius, `--lc-shadow-card`, `overflow: hidden`
- **Body:** centred. Padding 18px by default; 0 for full-bleed plates (glass, shadow, type lists, bars, rails, cards, map plates). Minimum height 84px.
- **Caption strip:**
  - Top hairline at 0.07, padding 8px 10px.
  - Mono 8.5px, tracking 0.14em, no wrap.
  - Label on the left in ink-9; note on the right in ink-6 (e.g. `PRIMARY` · `HOVER`).
- **Width:** auto, or as set by the cell (`300px` for control rows, `100%` for type lists, map plates and wireframes).

#### 4. Section rule `SPEC`, then the spec card

- A glass card holding a table with columns `minmax(110px,.8fr) | minmax(0,1.6fr) | minmax(0,1fr)`, 16px gap.
- **Header row:** `PROPERTY` · `VALUE` · `TOKEN`, Mono 8.5px, 0.14em, ink-5, padding 10px 16px, hairline at 0.07.
- **Rows:**
  - property: Geist 12px, ink-8
  - value: Mono 11px, bone
  - token: Mono 10px, ink-6, `overflow-wrap: anywhere`
  - hairline at 0.05 between rows

#### 5. Prev / next

- Two glass-bar buttons in a 2-column grid with a 12px gap, padding 12px 14px.
- Each shows a code (Mono 8.5px, ink-5, with `←` / `→`) over the name (Geist 13px). Hover: border 0.26.
- Next is right-aligned.

### Footer (system mode)

- **Tool group:** `← PREV` · `07 / 47` (bone, tabular-nums) · `NEXT →`.
- **Status line:**
  - signal mark and `DESIGN SYSTEM`
  - `/`
  - `REV A · 47 PARTS · 5 SECTIONS`
  - spacer
  - `GEIST · GEIST MONO · TOKENS.CSS`
  - `↩ STUDIO`
  - `GITHUB ↗`
- The readout card is hidden in system mode.

## Specimen renderers (`cells[].k`)

Build one small renderer per kind. Interactive kinds keep local state per plate, keyed `ds.<itemId>.<cellIndex>`. Wherever possible a renderer is just the production component with fixed props.

- **Foundations:**
  - `swatch`: 84×56 block, 1px white 0.12 border.
  - `textrole`: "Show land surface" in Geist 13px and "55.0343°N" in Mono 10px, both in the role colour.
  - `line`: 96×44 box showing a border and fill pair.
  - `glass`: a 220×132 terrain crop with the glass inset 22px, labelled `α 0.78` and `BLUR 24`.
  - `shadow`: a 132×60 glass box on a canvas-grey 220×132 ground.
  - `typeList`: rows in a grid `120px | 1fr | 150px`: spec · live sample · token.
  - `radius`: a 72×72 bone outline.
  - `space`: a hatched bar of the given width between two ink-5 ticks.
  - `height`: a 96-wide box at the given height.
  - `signal`: a swatch plus a `STATUS · OK` mark.
  - `pattern`: a 220×96 swatch of the pattern.
  - `motion`: a slider-style track; clicking runs the thumb 190px at the given duration with `--lc-ease`.
- **Primitives:**
  - `btnP`, `btnPh`, `btnS`, `btnSh`, `btnT`, `icon`, `btnPm`: buttons in a fixed state. The "hover" kinds render the hover style statically.
  - `seg`, `segM`: live segmented control.
  - `row`: one live inspector row (`ControlRow`).
  - `group`: group header plus a list of rows.
  - `search`, `searchM`: search fields.
  - `check`: live checkbox.
  - `kbd`: kbd hints.
  - `tagB`, `tagM`, `tagS`: the three tag variants.
  - `markSq`, `markDo`, `markDs`: square, outline diamond, solid diamond.
  - `progress`: progress bar at a set value.
  - `ghead`: group header.
  - `readout`: readout cell.
  - `brand`, `brandL`: bar and splash brand lockups.
- **Composites:**
  - `bar`: floating top bar on a terrain strip.
  - `rail`: inspector rail and header.
  - `rcard`: readout card.
  - `fault`: fault card.
  - `loader`: loader. A 12×3 tile grid fills centre-out (≤ 4.6 from centre, y weighted ×2).
  - `modebar`: mobile mode bar.
  - `tabbar`: mobile tab bar.
- **Overlays** (`plate` with `ov`): full-width, 280px tall terrain plates.
  - `hud`: corner brackets, ruler and camera readout.
  - `cross`: crosshair.
  - `crop`: crop frame. `box-shadow: 0 0 0 2000px` gives the surround.
  - `wipe`: A/B wipe. Draggable through an invisible range input. The B side is the same image with `filter: contrast(1.7) brightness(.82)`, clipped with `clip-path: inset(0 0 0 X%)`.
  - `route`: SVG polyline, 7px halo plus 2.5px bone line, with diamond waypoints.
  - `nodata`: hatch and a `NO DATA` tag.
  - Use the real overlay components where they exist.
- **Layouts:**
  - `wfDesk`: 16:9 schematic of the desktop shell.
  - `wfMob`: 210×430 phone schematic with live PEEK / HALF / FULL snaps. Sheet heights 92 / 190 / 330 at 320ms; the map controls fade out when the sheet is full.
- **Placeholder:**
  - `open`: 170×56 dashed box (1px white 0.22), `NOT YET DESIGNED` in Mono 9px, ink-6.

## Interactions

- Rail: switches the section (and clears search).
- Part row: selects the part.
- `↑ ↓ ← →` keys: step through all parts in registry order, wrapping at the ends. Ignored while an input is focused.
- Find: case-insensitive substring match over name, summary, source, group and code.
- The prototype's signal accent tweak re-colours every signal mark on the page, specimens included. In the app this is `--lc-signal`.
- Suggested, not in the prototype:
  - reflect the selected part in the URL (`?mode=system&part=PRIM.04`)
  - `⌘F` / `/` focuses Find in system mode

## State

- `mode`: `'studio' | 'system'`
- `modeTarget`: drives the canvas cross-fade ahead of the content swap
- `flip`: `{ angle, transition, busy }`
- `dsSection`
- `dsPart` (item id)
- `dsQuery`
- `dsPlateState`: a map of `ds.<itemId>.<cellIndex>` → value; lives for the session only
- Studio state is untouched.

## Implementation notes

- Put the registry in `src/system/registry.ts`, with `cells[].k` typed as a union. Unit-test that every `k` has a renderer.
- Lazy-load the system route chunk so the studio bundle doesn't grow.
- `ControlRow` (the inspector row switch) is shared between the studio and the specimens. It should be the same component in the app too.
- Parts, plates and spec rows are all data. Adding a component to the system should mean adding one registry entry.

## Assets

- Fonts: Geist and Geist Mono.
- The terrain plate image in the prototype is a stand-in screenshot. In the app, use a static render from the real terrain renderer (any greyscale frame, around 1200px wide), shipped as a static asset so system mode never needs WebGL.
