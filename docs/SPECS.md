# Writing Specs

How to write issues, roadmap entries and PRD-style docs so they can be built and tested without guesswork.

Adapted from the [spec-speak skill](https://github.com/conorluddy/marketplace/tree/main/plugins/spec-speak-plugin/skills/spec-speak), which draws on EARS, RFC 2119, INCOSE, ISO/IEC/IEEE 29148 and Gherkin. This is the lightweight version for a small product.

## Two zones, two dialects

Every passage is in one of two zones. Using the wrong style for a zone weakens the doc.

- **Exploratory** (problem, context, rationale, solution sketch, open questions): normal prose. Hedging is fine here: "we believe", "this may". It shows real uncertainty. Don't remove it.
- **Normative** (requirements, acceptance criteria, constraints): strict. EARS shape, one keyword, no weak words, every statement testable.

Decide which zone a passage is in, then write in that zone's style.

## Doc skeleton

```markdown
## Problem — what hurts, for whom, and how we know

## Context — constraints, prior art, links

## Requirements — REQ-1, REQ-2, … each with a rationale line

## Acceptance criteria — one Given/When/Then per REQ

## Out of scope — what this explicitly won't do

## Open questions — OQ-1, … decisions nobody has made yet

## Glossary — only terms the doc introduces
```

Small issues can skip sections, but never skip Out of scope or Open questions if there's anything to put in them.

## Requirements

Use one EARS shape per requirement:

| Shape      | Template                                               |
| ---------- | ------------------------------------------------------ |
| Ubiquitous | The `<system>` MUST `<response>`.                      |
| Event      | When `<trigger>`, the `<system>` MUST `<response>`.    |
| State      | While `<state>`, the `<system>` MUST `<response>`.     |
| Optional   | Where `<feature is enabled>`, the `<system>` MUST …    |
| Unwanted   | If `<failure>`, then the `<system>` MUST `<response>`. |

Rules:

- One capitalized keyword per statement: **MUST** (required), **SHOULD** (expected, deviation needs a reason), **MAY** (optional).
- One requirement per statement. "and" between two behaviours usually means two requirements.
- 25 words or fewer.
- Put the "why" on a separate `Rationale:` line, not in the statement.
- Quantify: number, unit, tolerance. "Within 2 s for a 4000 × 4000 px export", not "fast".
- Give explicit time: a deadline, interval or ordering, never "eventually".
- Use one term per concept, and define it in the glossary.
- PRDs say _what_, not _how_. Technical specs may record _how_, with its rationale.

### Weak words

These are banned in normative zones and fine in exploratory prose:

- **Vague:** appropriate, sufficient, reasonable, several, some, robust, seamless, easy, fast, minimal
- **Escape clauses:** as appropriate, if necessary, where possible
- **Open-ended:** etc., and so on, including but not limited to
- **Temporal:** eventually, soon, as soon as possible
- **Absolutes:** always, never, all, every (unless bounded and testable)

## Acceptance criteria

Write one Gherkin scenario per requirement. Describe behaviour, not implementation. If you can't write an observable `Then`, it isn't a requirement yet.

```gherkin
REQ-2: When the user exports a PNG at print size, the editor MUST render it at 300 DPI.

  Given a design with print size A3 selected
  When the user exports a PNG
  Then the image is 3508 × 4961 pixels
  And its contours match the SVG export of the same design
```

## Gaps: ask, don't invent

Sort every gap into one of two kinds:

- **Product decisions** (scope, behaviour, what users see). Only Conor can decide these. Ask, or record them as `OQ-n`. Never pick one quietly.
- **Engineering parameters** (timeouts, limits, sizes). Propose a sensible value inline and flag it: `MUST complete within 3 s [ASSUMPTION — confirm]`. List the assumptions at the end so they're quick to check.

When an agent is writing a spec interactively, it asks one batch of up to four high-impact questions, product decisions first. Anything left undecided becomes an open question.

## Example

**Rough note:**

> Would be good to export at print resolution. Maybe A-sizes? Real terrain should still have the credit on it. Shouldn't take forever.

**Spec fragment:**

```markdown
## Problem

Exports are sized in screen pixels, so print users must calculate dimensions
themselves. We believe A-series presets cover most print use, but haven't checked.

## Requirements

- REQ-1: The editor MUST offer A4, A3 and A2 export presets at 300 DPI.
- REQ-2: Where real terrain is enabled, the export MUST include source attribution.
  - Rationale: real-terrain output must credit its elevation source (AGENTS.md).
- REQ-3: The editor MUST finish an A2 PNG export within 10 s on an M-series laptop [ASSUMPTION — confirm].

## Open questions

- OQ-1: Do the CLI and the editor both get print presets, or the editor only?
```

The hedge in the problem statement stays. "Shouldn't take forever" becomes a number flagged as an assumption. CLI scope is a product decision, so it becomes an open question rather than a guess. Answering it also settles browser and CLI alignment.

## Auditing a spec

Apply the same rules as a review, and report findings in this order:

1. Undecided product questions written as if they were requirements.
2. Requirements that are untestable, plural or weak-worded. Quote the statement and name the rule.
3. Structural gaps: no out of scope, no open questions, zones mixed together.

Give a rewrite for each flagged requirement.

## Topogra glossary seed

- **Seed**: the integer that fully determines a synthetic landscape.
- **Height field**: the 2D grid of elevations contours are extracted from.
- **Contour interval**: elevation distance between adjacent contour lines.
- **Real terrain**: elevation from public Terrarium tiles rather than a seed.
- **Settled terrain**: terrain with no cursor deformation, used for static exports.
- **Design link (v1)**: a versioned URL that must keep reproducing the same design.
