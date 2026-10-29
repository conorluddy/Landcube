# src/ui

LANDCU.BE design-system components. Each is a React component plus a CSS file, a markup test and a specimens file, all co-located. `Tag` is the pattern to copy.

## Files per component

- `<name>.tsx`: named export, no CSS import (node tests import components under `tsx`).
- `<name>.css`: add `@import './<name>.css';` to the matching block of `ui.css`. That is the only place CSS is aggregated; `src/main.ts` and `src/specimens/main.tsx` each import `ui.css` once.
- `<name>.test.tsx`: markup assertions via `renderMarkup` from `test-helpers.ts`.
- `<name>.specimens.tsx`: default-exports `Specimen[]` built with `defineSpecimens('<name>', [...])`. The catalogue globs `*.specimens.tsx`, so no registration step.

## Rules

- Class prefix `lc-`, BEM-ish, class-only selectors. Tokens only (`var(--lc-*)`), no colour literals, no element selectors.
- Variants via `data-variant` / `data-size`. States via native pseudo-classes and ARIA (`[aria-pressed='true']`, `:disabled`), never state classes.
- Caps and tracking are CSS (`text-transform`); DOM text keeps authoring case.
- Glass surfaces carry `data-ui-surface`.
- Cover disabled, long label, empty value, narrow width, `prefers-reduced-motion` and `forced-colors` in specimens and tests.

## Forced states

A specimen with `state: 'hover' | 'focus' | 'active'` renders inside an `<article data-force-state="...">`. Give each pseudo-class rule a twin:

```css
.lc-button:hover,
[data-force-state='hover'] .lc-button {
  /* ... */
}
```

## Specimens page

`npm run dev`, then open `/specimens.html`. Filters: `?only=tag` (component id), `?theme=light`. Each `<article data-specimen="component/variant/size/state">` is screenshotted by `tests/browser/specimens.spec.ts` in default, reduced-motion and forced-colors modes.

The page is built by `npm run build:specimens` into `dist-specimens/`. `vite build` only builds `index.html`, so `dist/` never contains it (`tests/specimens-build.test.ts` asserts that).

## Screenshots

`npm run test:e2e` compares against committed baselines. After an intended visual change run `npm run test:e2e:update-snapshots` and commit the PNGs under `tests/browser/specimens.spec.ts-snapshots/`. Baselines are per platform (`-darwin`); do not update the studio `visual.spec.ts` baselines for specimen work.
