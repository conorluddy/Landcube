# Code Style

> Context is finite. Write for humans with limited working memory and agents with bounded context windows. Maximize signal, minimize noise.

Adapted from [conorluddy/Codestyle](https://github.com/conorluddy/Codestyle) for LANDCU.BE.

## Philosophy

- **Progressive disclosure**: files answer "what is this?" in the first 10 lines. Types → public API → private helpers.
- **Self-documenting**: names remove the need for comments. Comments explain "why", never "what".
- **Aggressive minimalism**: simplest correct solution. No speculative abstractions or options nobody asked for.
- **AHA over DRY**: wait for the third duplication before extracting. The wrong abstraction costs more than duplication.

## Determinism and reproducibility

LANDCU.BE's output is a pure function of seed and settings. Shared design links depend on it.

- The rendering pipeline takes randomness as a parameter (`createSeededRandomGenerator` in `src/terrain-generation.ts`). Never call `Math.random` or read the clock inside it.
- `Math.random` is allowed only at the edges, to pick a fresh seed or palette, and is injected (see `createRandomPalette`).
- Changing a default, a terrain formula or URL serialization in `src/design-settings.ts` can silently change existing version-one links. Add a new link version instead, and cover the old one with a test.
- Browser and CLI behaviour lives in the shared pipeline. Never fix or add something on one side only.
- Static exports use settled terrain without cursor deformation. Real-terrain output carries source attribution.

## Naming

- Be specific: `visibleContourPaths` not `paths`, `tileFetchTimeoutMs` not `timeout`.
- Include units: `contourIntervalMeters`, `exportWidthPixels`, `delayMs`.
- No abbreviations: `configuration` not `cfg`, `elevation` not `elev`.
- Domain language: seed, height field, contour level, sea level, real terrain, palette.
- Booleans: `isRealTerrain`, `hasAttribution`, `shouldSettleTerrain`.
- Verbs for functions: `extractContourPaths()`, `validateDesignSettings()`.

## Functions

- Single responsibility, describable in one sentence.
- Dependencies as parameters: random sources, storage, fetch, canvas. No hidden module state.
- Strict TypeScript, no `any`.
- Guard clauses over nesting. Happy path unindented.
- 50 lines is a refactoring trigger, not a hard limit.

## Error handling

- **Expected failures at boundaries return `Result<T>`** (`src/types/operations.ts`): CLI configuration, design-link parsing, saved seeds, terrain tile fetches, file I/O. See `readLockedSeed` in `src/design-sharing.ts`.
- Errors are `OperationError`: `{ code, message, retryable }`, with codes from `src/constants/operations.ts`.
- **Internal invariants may throw**, with an actionable message. Don't convert existing throws without a reason.
- Messages say what failed, expected vs actual, and how to fix it.
- Never swallow an error silently. Return it, rethrow it, or surface it to the user.
- Validate at the boundary once, then carry the proof in the type: `ValidatedDesignSettings` in `src/types/design.ts` is the model.

## File and module organisation

- `src/constants/` and `src/types/` hold shared domain constants and types. Define types before implementation.
- Pipeline modules (terrain, contours, composition, SVG) stay platform-free. Browser-only code (DOM, canvas) and Node-only code (Resvg, filesystem) live at the edges (`src/main.ts`, `src/cli.ts`, `src/export/`).
- Public API first, helpers at the bottom. One major export per file.
- 300 lines per file is a refactoring trigger.
- Section comments (`// === PUBLIC API ===`) where a file has distinct layers.

## Testing

| Layer       | Tool                            | Covers                                            |
| ----------- | ------------------------------- | ------------------------------------------------- |
| Static      | `tsc --noEmit`, `npm run lint`  | Types, lint rules                                 |
| Unit        | `npm test` (node:test)          | Pure helpers                                      |
| Integration | `npm test`                      | Settings → terrain → contours → SVG, CLI commands |
| E2E         | `npm run test:e2e` (Playwright) | Critical editor journeys only                     |
| Package     | `npm run test:package`          | The published CLI works when installed            |

- Most tests should be integration tests through the shared pipeline.
- Test behaviour, not implementation. One concept per test.
- Names describe scenarios: `test('version-one link renders the same contours')`.
- Tests sit next to their module (`src/cli.test.ts`). Cross-cutting tests and fixtures go in `tests/`.
- Anything touching seeds, defaults or serialization gets a reproducibility test.
- Coverage (`npm run test:coverage`) is a guide, not a target.

## Agent-friendly patterns

- **Idempotent operations**: exports and file writes can be re-run safely.
- **Explicit state**: discriminated unions over boolean flags (see `DesignChangeKind`).
- **Machine-parseable errors**: `OperationError`, not bare strings.
- **Convention over configuration**: `*.test.ts`, types in `src/types/`, constants in `src/constants/`.
- **Context boundaries**: a pipeline module should be understandable without loading the browser or CLI.
- **Token-dense docs**: "Seeded fBm height field, marching squares contours", not a paragraph.

## Anti-patterns

Hasty abstractions, clever code, silent failures, `any`, hidden dependencies, nested conditionals, "what" comments, unseeded randomness in the pipeline, browser/CLI drift, changing defaults that break existing links.

## Checklist

- [ ] Minimal code for the stated problem?
- [ ] Same output for the same seed and settings?
- [ ] Browser and CLI still aligned?
- [ ] Expected failures return `Result` with an actionable message?
- [ ] Names specific, with units?
- [ ] Single responsibility, explicit dependencies?
- [ ] Behaviour covered by tests?
- [ ] File reads types → public API → helpers?
