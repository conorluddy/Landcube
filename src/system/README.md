# src/system — design-system mode

A footer link (`Design system ◧`) flips the studio into a living specimen book. The terrain fades out, a drafting grid fades in, and the inspector flips over to become the part navigation. `Esc`, `← Back to studio` or `↩ Studio` flip it back. Studio state is untouched; only `workspace.mode` changes.

## Key decisions

- **No second copy of any component.** Component plates are the `defineSpecimens` entries from `src/ui/**/*.specimens.tsx`, the same ones `/specimens.html` and the screenshot suite use (`specimen-catalogue.ts`). The registry holds only editorial metadata.
- **Foundations read live tokens.** Tokens aren't components, so `foundation-plates.tsx` draws them. Every value shown comes from `getComputedStyle` (`token-value.ts`), never from a copy.
- **Real terrain behind plates.** `assets/terrain-plate.webp` is a greyscale frame from the real 3D renderer, captured by `npx tsx scripts/capture-terrain-plate.ts` (default location, bundled tiles, so it runs offline). Overlay specimens pick it up through `--lc-specimen-stage-background`; the catalogue keeps its flat stand-in. Recapture when the renderer's look changes.
- **Layouts are diagrams or real components.** The desktop shell is drawn to scale from the shell's numbers. The phone is real `BottomSheet`, `FloatingBar` and `IconButton` at 390 × 800, scaled into a 210px frame, so its snaps are the sheet's own.
- **Curated plates.** A part can list `plates` (`variant/size/state` keys) when its specimen set is mostly edge cases; the title tag then reads `06 of 33 plates`. Every specimen still renders at `/specimens.html` and in the screenshot suite. `registry.test.tsx` checks every listed key exists.
- **Plates keep their state.** Visited pages stay mounted behind `Activity`, so a dragged slider keeps its value after browsing away and back.
- **Lazy chunk.** `src/studio/app.tsx` loads `system-mode.tsx` with `React.lazy`. The studio entry bundle carries none of this folder (`tests/specimens-build.test.ts`).
- **Desktop only.** Below 768px the mode falls back to the studio.

## Files

| File                                          | Role                                                                |
| --------------------------------------------- | ------------------------------------------------------------------- |
| `registry.ts`, `registry.types.ts`            | Sections, the ordered parts, and their codes (`PRIM.04`)            |
| `parts/foundations.ts`, `parts/components.ts` | Part metadata: name, summary, spec rows                             |
| `part-search.ts`                              | Find, step (wrapping) and grouping; pure                            |
| `system-mode.tsx`                             | Lazy entry point: header, HUD, stage, nav, footer as shell children |
| `system-stage.tsx`, `plate.tsx`               | Title block, plates, spec table, prev / next                        |
| `system-nav.tsx`                              | The flipped inspector                                               |
| `system-chrome.tsx`                           | System header, footer and HUD                                       |

The flip itself lives in `src/studio/mode-flip.ts`. It is timer-driven, not rAF, so a background tab can't leave the panel edge-on. A toggle made mid-flip is held and runs as the flip finishes, so an early Esc is never dropped. `src/main.ts` suspends 3D drawing once the canvas has faded out.

## Links

`?mode=system&part=<id>` opens straight into a part, for example `?mode=system&part=ruler-slider`. It works on desktop only; on a phone the link is dropped. Codes (`PRIM.08`) are accepted too, and the address bar settles on the id, because codes shift whenever a part is added. The address bar follows the part on show. Leaving the mode drops both keys, and design parameters (`v`, `seed`, …) are left untouched. `src/system-link.ts` reads and writes the keys. `replaceDesignUrl` keeps them in the address bar but never puts them in a share link.

`/system` paths aren't supported: static hosting with `base: './'` has no fallback route.

## Keys and focus

- `↑ ↓ ← →` step through parts, wrapping. Modified arrows belong to the browser (Alt+← is Back). Fields, plates and ARIA widgets keep their own arrows (`browse-keys.ts`).
- `Esc` flips back to the studio. In Find, the first Esc clears the query; the next one exits.
- `⌘F` / `Ctrl+F` or `/` focuses Find.
- Entering from the studio focuses the current part row; a link straight in leaves focus alone. Leaving focuses the `Design system ◧` link.
- If the chunk fails to load, the studio comes back with an E-304 status, and the next click retries.

## Adding a part

Add a component in `src/ui` with its specimens file, then one `part(...)` line in `parts/components.ts`. `registry.test.tsx` fails until every specimens file has a part.

## Gotchas

- Nothing unmounts on a flip: `app.tsx` hides the off-screen side with React `Activity`, so studio tools, place search, Find and plate values all survive a round trip. Hidden effects (key and pointer listeners) are torn down while hidden.
- Text printed on the light ground sits in `.system-print`, which re-points `--lc-bone` and friends at ink, so shared components such as `Tag` and `GroupHeader` read correctly on the canvas.
- Arrow keys browse parts unless a field has focus or a component already handled the key (`defaultPrevented`), so rail, segmented and slider arrows keep working.
