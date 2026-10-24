# Code Style

> Optimize for the context needed to understand and safely change code. Keep related knowledge together, shared contracts discoverable, and names explicit.

## Philosophy

- **Progressive Disclosure**: Show the file's purpose and public API first; place implementation details after it.
- **Self-Documenting**: Prefer clear names and types. Add minimal JSDoc to functions and meaningful logical blocks to explain purpose or intent; avoid repeating signatures or narrating obvious statements.
- **Cohesion Before Extraction**: Keep an operation and its implementation details together. Extract when reuse or a clear domain boundary makes comprehension easier.
- **One Source of Truth**: Centralize shared contracts, defaults, domain values, and repeated behavior. Similar-looking code or equal literals do not necessarily represent the same concept.
- **Minimal Abstraction**: Prefer the smallest useful abstraction. A little duplication is acceptable when extraction would couple unrelated behavior or require more context to understand it.

## Naming

- Prefer explicit, domain-specific names over short names: `activeCustomerRecords` over `records` when context is unclear.
- Use descriptive names for variables, parameters, properties, functions, and files. Prefer `configuration` to `cfg`; avoid adding words that repeat information already clear from the scope or type.
- Function names start with a verb and describe their effect or result: `calculateContourLevels()`.
- Boolean names use `is`, `has`, `can`, or `should` prefixes.
- Include units in time, size, and rate names: `delayMs`, `fileSizeBytes`.
- Keep established domain terms and standard acronyms where they improve clarity; verbosity should clarify, not add noise.
- Short conventional names such as `x` and `y` are appropriate in coordinate math. Use longer names when they distinguish roles, units, or lifecycle.

## Constants and Enums

- Put shared constants, enum-like values, and canonical configuration values in centralized constants modules, organized by domain (for example, `src/constants/terrain.ts`).
- Import the canonical definition when a value represents the same shared concept. Keep independent concepts separate even when their current values match.
- Name meaningful values, including thresholds and defaults. Keep one-use implementation constants near their consumer; leave obvious arithmetic, markup, and local strings inline.
- Keep constants modules focused by domain. Do not create one unstructured repository-wide dumping ground.
- Use `as const` objects or union types for fixed string values when that fits the codebase; use TypeScript `enum` only when runtime enum behavior is needed.

## Types

- Define shared types in centralized, domain-scoped type modules (for example, `src/types/terrain.ts`).
- Keep one-off implementation details local when centralizing them would add indirection without reuse.
- Keep a public contract beside its owning API when this makes that module self-contained; move it to a shared type module when independent consumers need it.
- Define contracts before implementation. Prefer precise unions and branded types at validated boundaries; avoid `any`.
- Export only types that have consumers outside their defining module. Avoid duplicate or near-duplicate type definitions.

## Functions

- Give each function one clear responsibility and pass dependencies explicitly.
- Type public contracts and boundaries; use strict TypeScript and let inference handle clear local values.
- Handle invalid or exceptional cases early with guard clauses.
- Keep functions focused. Treat 50 lines as a refactoring prompt, not a hard limit.
- Reuse shared behavior rather than copying logic, while avoiding abstractions that obscure the domain operation.

## Error Handling

- Represent expected failures with typed results where that matches surrounding APIs; reserve thrown exceptions for exceptional failures.
- Never silently swallow errors. Propagate or handle them with actionable context.
- Validate external inputs at boundaries and report expected versus actual values when useful.

## File and Module Organization

- Group code by feature or domain, then use predictable names such as `constants/terrain.ts` and `types/terrain.ts` for shared definitions.
- Keep shared definitions centralized without turning central files into catch-all modules.
- Order files for progressive disclosure: imports and exported contracts/API first, then implementation helpers.
- Keep modules cohesive and limit cross-domain dependencies.
- Prefer one primary responsibility per file; split files when it improves navigation, not to satisfy an arbitrary line count.
- Do not create a new file solely because a declaration is a type, constant, or helper. A file should group cohesive knowledge or provide a useful boundary.
- Co-locate tests with the code when practical; test files use `*.test.ts`.

## Testing

- Test observable behavior and important integration paths; keep each test focused on one scenario.
- Name tests for the behavior and conditions they cover.
- Add or update tests for meaningful behavior changes and shared logic.

## Observability

- Log at meaningful system boundaries, especially external calls and handled failures.
- Include relevant identifiers and measurements in structured logs when logging infrastructure exists.
- Avoid duplicate events for one operation.

## Agentic Patterns

- Make repeatable mutations idempotent where applicable.
- Model meaningful state transitions explicitly with discriminated unions.
- Use structured errors when callers need to make decisions from failures.
- Keep changes cohesive and independently reviewable.
- Return observable change details for mutations when the caller benefits from them; do not add ceremony to simple local updates.

## Context and Documentation

- Keep docs concise, scannable, and specific. Put detailed guidance near the module it describes.
- Prefer focused exports and imports so callers can discover the canonical definition without loading unrelated domains.
- Evaluate the whole reading path: files opened, imports followed, tokens loaded, and unrelated concepts encountered. Fewer lines in one file do not guarantee less context overall.
- Keep common changes understandable within one module and its immediate contracts. Avoid chains of tiny helpers and forwarding-only barrel modules.
- Avoid speculative abstractions, duplicate sources of truth, catch-all modules, and comments that restate code.

## Checklist

- [ ] Is each shared constant or type defined once in the appropriate domain module?
- [ ] Does extraction reduce total context without creating catch-all modules or unnecessary file hopping?
- [ ] Are names explicit, domain-specific, and free of unnecessary abbreviations?
- [ ] Is the abstraction backed by real reuse or a clear domain boundary?
- [ ] Are one-use details kept close to the code that explains them?
- [ ] Are types precise and errors actionable?
- [ ] Are behavior changes covered by focused tests?
