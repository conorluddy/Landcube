# src/system — design-system mode

A footer link (`Design system ◧`) flips the studio into a living specimen book. The terrain fades out, a drafting grid fades in, and the inspector flips over to become the part navigation. `Esc`, `← Back to studio` or `↩ Studio` flip it back. Studio state is untouched; only `workspace.mode` changes.

## Key decisions

- **No second copy of any component.** Component plates are the `defineSpecimens` entries from `src/ui/**/*.specimens.tsx`, the same ones `/specimens.html` and the screenshot suite use (`specimen-catalogue.ts`). The registry holds only editorial metadata.
- **Foundations read live tokens.** Tokens aren't components, so `foundation-plates.tsx` draws them. Every value shown comes from `getComputedStyle` (`token-value.ts`), never from a copy.
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

The flip itself lives in `src/studio/mode-flip.ts`. It is timer-driven, not rAF, so a background tab can't leave the panel edge-on. `src/main.ts` suspends 3D drawing once the canvas has faded out.

## Adding a part

Add a component in `src/ui` with its specimens file, then one `part(...)` line in `parts/components.ts`. `registry.test.tsx` fails until every specimens file has a part.

## Gotchas

- Text printed on the light ground sits in `.system-print`, which re-points `--lc-bone` and friends at ink, so shared components such as `Tag` and `GroupHeader` read correctly on the canvas.
- Arrow keys browse parts unless a field has focus or a component already handled the key (`defaultPrevented`), so rail, segmented and slider arrows keep working.
