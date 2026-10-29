# Studio UI organisation (proposal)

Status: discussion draft. This covers *where controls live and how they are
grouped*. The visual design system for the controls themselves is a follow-up.

## 1. Inventory: every control, by where it lives today

Legend: **2D**/**3D** = only shown in that view. **P**/**R** = only for
procedural / real terrain.

### Header
| Control | Kind |
|---|---|
| View 2D / 3D | segmented |
| Source Procedural / Coordinates | segmented |
| Place search (R) | search field |
| Copy style link | button |
| Export | button → modal |

### Footer
| Control | Kind |
|---|---|
| Controls expand/collapse | button |
| Overlays | button → popover |
| Orbit (3D) | button → popover |
| Tour play/pause | toggle button |
| Status, attribution, GitHub | passive |

### Inspector tab: Terrain
| Group | Controls |
|---|---|
| Autoplay | Tour preset locations; Delay; Cycle daylight; Day length |
| Procedural landscape (P) | Lock seed; New landscape; Feature scale; Terrain detail |
| Real location (R) | Saved/preset places; Latitude; Longitude; Area span; Max depth below sea level; Elevation floor; Load |

### Inspector tab: Contours
| Group | Controls |
|---|---|
| Contour interval (R) / Density (P) | Interval mode; Interval (m) / Density |
| Contour appearance | Contour colour; Opacity; Weight |
| Index contours | Index style; Every N; Index weight; Dash; Gap |
| 3D contours (3D) | Contour lines; Treatment drawn/engraved; Groove width; Groove depth |

### Inspector tab: Colour
| Group | Controls |
|---|---|
| Palette | Preset tiles; Random; Canvas colour |
| Materials (3D) | Material preset |
| Land (3D) | Land finish; Surface colour/tint |
| Water material (3D) | Water finish; Match terrain; Water colour |
| Elevation gradient | Colour by elevation; Gradient preset; Transitions; Stop colours/positions; add/remove/reverse |
| — | Reset design style |

### Inspector tab: Scene
| Group | Controls |
|---|---|
| Cursor interaction (P) | Enable; Radius; Strength; Response time |
| Surface (3D) | Show land surface; Solid base |
| Ground (3D) | Studio floor; Match canvas; Floor colour |
| Water (3D) | Water style; Water opacity; Preview water level; Water level |
| Lighting (3D) | Time of day; Flat light; Direction; Intensity; Fill; Haze; Reset lighting |

### Inspector tab: Camera (3D)
| Group | Controls |
|---|---|
| Lens | Projection; Focal length |
| Focus | Effect; Band position/width/blur; Aperture; Follow orbit target; reset focus |
| Exposure | Exposure; Reset camera |

### Inspector tab: Model (3D)
| Group | Controls |
|---|---|
| Crop preview | passive |
| Model dimensions | Width/Diameter; Length; Base thickness |
| Shape | Terrain shape smooth/terraced; Auto height; Height exaggeration |

### Inspector tab: Frame (3D)
| Group | Controls |
|---|---|
| Frame | Style tiles; Finish tiles |
| Dimensions | Border/Overhang; Clearance; Rim above base; Stand height |
| Edge | Edge shape tiles; Edge size; Floating toe |

### Popover: Overlays
| Group | Controls |
|---|---|
| Decorative grid (2D) | Grid style; Spacing; Grid opacity |
| Summit markers (2D) | Marker size; Triangles; Crosses |
| Geographic decorations (3D) | Map grid; Floor style |
| Grass (3D) | Enabled; Look; Blade length; Base/Tip/Dry colour; Density; Coverage; Clumping; Length variation; Colour variation; Dryness; Altitude limit; Wind; Slope limit |
| Roads (3D, R) | Mapped roads; Detail; Road colour; Road width; Auto width; Road texture; Retry |
| Sea level (R) | Sea-level hatching |

### Popover: Orbit (3D)
| Group | Controls |
|---|---|
| Orbit | View preset buttons; Auto-rotate; Rotation speed; Turn direction; Reset orbit |

### Modal: Export
| Group | Controls |
|---|---|
| 2D image | Format; Size preset; Allow extra-large; Width; Height; Resolution; Transparent; Download |
| 3D still (3D) | Scale; Download |
| STL (3D) | Part list; per-part downloads; attribution |

Roughly 130 controls across 11 surfaces.

## 2. What is wrong with the current structure

1. **Three homes, no rule for which one.** Inspector tabs, footer popovers and
   the header all hold settings. Overlays is the single largest body of
   controls (grass alone has 14) and is hidden behind a footer button. Orbit is
   a popover while Camera is a tab, though both answer "how am I looking at
   it".
2. **Tabs follow the code, not the user's intent.** Water is split across
   Colour (finish, colour), Scene (style, level) and Overlays (sea-level
   hatching). Colour is set in Colour, Scene (floor), Contours (line) and
   Overlays (grass, roads). Contour engraving is in Contours while the surface
   it cuts into is in Scene.
3. **Tour is split.** Play/pause is in the footer, its options are in Terrain,
   and the daylight cycle option is really a lighting setting.
4. **Mode-dependence is invisible.** Three tabs and many groups appear or
   vanish with 2D/3D and procedural/real. Users cannot discover what 3D or a
   real place would unlock.
5. **No hierarchy.** Seed, palette and time of day carry the same visual
   weight as fill light, groove depth and grass clumping. Scene is a flat
   stack of about twenty controls.
6. **Resets are inconsistent.** Reset design style, reset lighting, reset
   camera, reset orbit, reset focus: five buttons, five scopes, five places.
7. **Hints do the work of structure.** Export and link exclusions ("excluded
   from static exports", "excluded from style links") are repeated as body
   text in several panels.

## 3. Proposed model

Two axes.

**Axis 1: subject.** Group by the thing being shaped, not by rendering layer.
Every control has exactly one home, and that home is the same in 2D and 3D.

**Axis 2: depth.** Each panel has three layers: a header that summarises state
and offers on/off and reset; a tile or primary row for the 80% choices; and a
"Fine-tune" disclosure for the rest.

### 3.1 Shell

- **Top bar**: Source (Procedural | Place) with seed or place search inline;
  View (2D | 3D); Share; Export. Global modes only.
- **Viewport toolbar** (floating, bottom of canvas): Tour, Orbit presets (3D),
  Cursor interaction (P), Hide panels. Transient and playback tools, not
  settings.
- **Sidebar**: a single scrollable stack of collapsible panels, replacing both
  the tab strip and the two popovers. One open at a time by default, with a
  pin to keep several open. Panels that do not apply to the current mode are
  shown dimmed with the reason ("3D only", "Real places only") rather than
  removed.
- **Export** stays a modal with tabs: Image, Still, Print (STL).

### 3.2 Panels (in sidebar order)

| Panel | Primary row (tiles) | Fine-tune | Moves in from |
|---|---|---|---|
| **Landscape** | Seed reroll + lock (P) or place search + saved places (R) | Feature scale, detail (P); lat/lon, span, depth, floor (R); relief: exaggeration, auto height, smooth/terraced (3D) | Terrain, Model (shape) |
| **Contours** | Density/interval; weight | Opacity, index contours, treatment drawn/engraved + groove (3D) | Contours (unchanged, 3D group already here) |
| **Colour** | Palette tiles + random; gradient presets | Canvas, line colour, gradient stops; land finish + tint, floor colour, material preset (3D) | Colour, Scene (ground), Contours (line colour) |
| **Light** (3D) | Time-of-day tiles: dawn / noon / dusk / night + dial | Direction, intensity, fill, haze, flat, daylight cycle + day length | Scene (lighting), Terrain (autoplay cycle) |
| **Water** | Style tiles: off / hatched / solid | Level, preview, finish, opacity, colour, match terrain, sea-level hatching (R) | Scene, Colour, Overlays |
| **Features** | Toggle tiles: Grid, Summits (2D); Map grid, Floor style, Grass, Roads (3D) | Each tile expands to its own controls | Overlays |
| **Camera** (3D) | View preset tiles; projection | Focal length, focus effect + params, exposure, auto-rotate + speed + direction | Camera, Orbit |
| **Print** (3D) | Frame style tiles | Model size, base thickness, frame finish, dimensions, edge, crop preview | Model, Frame |

Tour options (delay, preset locations) live in the viewport toolbar's Tour
flyout. Surface visibility toggles (show land, solid base) are preview-only
and belong beside Camera's fine-tune or in the viewport toolbar.

### 3.3 Cross-cutting rules

- **One reset per panel**, in the panel header, same icon everywhere.
- **Share scope indicator.** Settings that travel in a style link get a small
  link glyph on the panel header or control; the one place the exclusion is
  spelled out is the Share surface. This keeps the current serialization
  untouched (version-one links stay stable) while making the boundary visible.
- **Conditional controls stay visible but disabled**, with a one-line reason,
  rather than mounting and unmounting.
- **Tiles for presets, sliders for continuous values, no bare selects for
  choices of five or fewer.** Selects remain for long lists (places, sizes).
- **Panel header shows a live summary** ("Water · solid · 12 m", "Light ·
  07:30 · haze 20%") so a collapsed stack still reads as a status board.

## 4. Open questions

- Keep a 2D/3D view switch at all, or make 3D a panel ("Relief") that the
  user turns on? Switching views currently hides and reveals half the UI.
- Does Features split into separate Grass and Roads panels once they grow?
- Mobile: the sidebar stack becomes a bottom sheet; tiles need a horizontal
  scroll variant.

## 5. Next step

Agree the panel list and the three-layer depth model, then design the control
kit: tile, toggle tile, dial, range, swatch, number, disclosure, panel header.
