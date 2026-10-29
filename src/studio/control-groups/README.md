# src/studio/control-groups

One builder per inspector section turns `(controller, state)` into typed `ControlGroupDefinition[]`, which `ControlGroup` (`src/ui/`) renders. `terrain.ts` is the reference; copy it.

## Steps to migrate a section

1. Create `<section>.ts` exporting `build<Section>Groups(controller, state): ControlGroupDefinition[]`. Plain `.ts`, no JSX: use `createElement` for the rare ReactNode.
2. Emit one group per id in `src/studio/sections.ts` (`group.id` must be registered; the code `TERR.02` comes from its position). Add the builder to `controlGroupBuilders` in `index.ts`.
3. In `app.tsx` `renderSectionBody`, replace the section's `legacyControls(<XPanel />)` with `build<Section>Groups(props.controller, props.state).map((group) => <ControlGroup key={group.id} group={group} code={getGroupCode(group.id)} />)`. No wrapper div.
4. Delete the `XPanel` from `panels.tsx` (or its own file), then every import, `fields.tsx` helper or CSS rule only it used (`npm run lint` and `tsc` flag the imports; grep class names for the CSS).
5. Tests: `<section>.test.ts` next to the builder (group ids per state, binding row ids rendered), then `npm run check:source`, `npm run test:e2e`. Refresh `visual.spec.ts` baselines deliberately.

## Rules

- Row `id` equals the legacy field id (e2e binds to it). Ids are unique across the studio; `ControlGroup` throws on a repeat within a group. Rows with no legacy id get a descriptive kebab-case one.
- Use the factories in `../control-rows.ts`: `designRangeRow` (id is the setting name), `toggleRow`, `selectRow`/`segmentedRow`/`tilesRow` (typed options), `numberRow`, `colourRow`, `hintRow`, `statusRow`, `buttonRow`, `customRow`. Rows without a factory (`range`, `pair`, `link`, `buttons`) are plain object literals; `kind` is the discriminant.
- A hidden group is simply not returned; its code leaves a gap. A hidden row is `condition && row`.
- Callbacks are copied verbatim from the panel. The builder reads `state` and only closes over `controller`.
- `hintRow` takes ReactNode; `<output id="seed-value">` lives in one. `selectRow` with `isPositionShown: false` for grouped option lists.
- `statusRow` keeps role: `isAlert` for `role="alert"`, else `role="status"`. `isAlwaysMounted: true` when the live region must exist while empty.
- `customRow(id, render)` for what has no row kind (place search, gradient editor). Its wrapper carries the id.
- New styling goes in `src/ui/*.css` with `lc-` tokens, never in `landscape-studio.css`.

## Gaps found in #90

- Range suffix is `unit`, number `optional` is `isOptional`, Button `primary` is `variant: 'primary'`.
- `link` rows add the external glyph themselves; drop a trailing arrow from the label.
