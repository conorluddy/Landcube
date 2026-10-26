<!-- Title: emoji + four words, e.g. "🗺️ Add real terrain attribution" -->

## What & why

<!-- One or two sentences. Link the issue: Closes #N -->

## Labels

<!-- Apply in the sidebar: type:*, size:*, risk:*, blast:*. Add ai-shippable if clarity:4+ and risk:2 or lower. -->

## Surfaces touched

- [ ] Browser editor
- [ ] CLI
- [ ] Shared pipeline (settings, terrain, contours, composition, SVG)
- [ ] Export (SVG / PNG)
- [ ] Agent skill / plugin manifests
- [ ] Docs only

## Invariants

- [ ] Browser and CLI stay aligned (change lives in the shared pipeline, or both sides updated)
- [ ] Version-one design links still reproduce identical output (defaults and terrain semantics unchanged)
- [ ] Real-terrain output keeps source attribution
- [ ] Static exports use settled terrain (no cursor deformation)

## Verification

- [ ] `npm run check` passes
- [ ] `npm run test:e2e` (if the browser editor changed)
- [ ] Skill and manifests updated (if CLI flags or behaviour changed)

<!-- Before/after renders or screenshots for visual changes -->
