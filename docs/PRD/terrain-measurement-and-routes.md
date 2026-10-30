# Terrain measurement and routes

Status: Approved product direction; ready for technical design.

## Problem

LANDCU.BE users can measure horizontal distance between two points, but cannot inspect the elevation change or explore a route through several waypoints. The current screen-space line does not communicate terrain shape.

Users exploring hills need to distinguish map distance, terrain-following distance, and elevation change. Visual exaggeration and terraces help explain a landscape, but those display choices should not alter geographical measurements.

## Context

The agreed direction keeps Measure as a straight, two-point tool and introduces Route for manually placed waypoints. Routes connect those points directly across terrain; they do not find trails.

The first release covers real terrain, drawn routes, and imported GPX routes. It includes an elevation profile, adjustable steep-section highlighting, Library persistence, and GPX export. Procedural terrain retains its existing basic Measure behaviour.

Existing capabilities include geographic point picking, terrain height sampling, GPX import, route overlays, and Library saves. Imported GPX elevations currently come from the file. Existing route overlays are suppressed on terraced models, and existing saved designs primarily store design links. These are integration constraints, not reasons to reduce the agreed scope.

Source elevations mean the loaded elevation dataset after existing data-repair preprocessing, before display-specific transformations. They are estimates at the dataset's resolution, not surveyed measurements. Source attribution remains visible through the existing terrain attribution UI.

Related guidance: [Writing specs](../SPECS.md), [Code style](../CODESTYLE.md).

## Requirements

### Measurement and elevation basis

- **REQ-1:** While real terrain is active, Measure MUST retain its straight, two-endpoint presentation.
  Rationale: Measure remains the quick alternative to drawing a route.
- **REQ-2:** When two Measure endpoints are placed, Measure MUST display horizontal distance and bearing.
  Rationale: Preserve the existing measurement readout.
- **REQ-3:** When both endpoints have source elevations, Measure MUST display each endpoint's elevation in metres.
  Rationale: Users need the heights behind the comparison.
- **REQ-4:** When both endpoints have source elevations, Measure MUST display signed elevation difference as end elevation minus start elevation.
  Rationale: Direction determines whether the measurement rises or falls.
- **REQ-5:** The editor MUST derive terrain analysis elevations from source elevations before display transformations.
  Rationale: Exaggeration, terraces, elevation clipping, model dimensions, crop, and camera pose must not change geographical results within unchanged coverage.
- **REQ-6:** When the camera moves, the editor MUST preserve measurement endpoints at their terrain coordinates.
  Rationale: A measurement belongs to the landscape rather than the screen.
- **REQ-7:** If a Measure endpoint lacks source elevation coverage, Measure MUST identify its elevation as unavailable.
  Rationale: Missing data must not appear as zero elevation.
- **REQ-8:** While procedural terrain is active, the editor MUST retain the existing basic Measure behaviour.
  Rationale: This release does not introduce nominal elevation analysis for synthetic landscapes.

### Route creation and editing

- **REQ-9:** While real terrain is active, the editor MUST offer Route alongside Measure on desktop and mobile.
  Rationale: Both interaction layouts need access to route creation.
- **REQ-10:** When a user places successive route waypoints, Route MUST connect them in placement order without trail snapping.
  Rationale: This is direct waypoint planning, not navigation or pathfinding.
- **REQ-11:** While editing a route, Route MUST provide waypoint repositioning by dragging.
  Rationale: Users need to refine a route against terrain.
- **REQ-12:** When a user selects a route segment for insertion, Route MUST insert a waypoint between that segment's endpoints.
  Rationale: Intermediate points let users refine the path without redrawing it.
- **REQ-13:** When a user deletes a selected waypoint, Route MUST remove it from the ordered route.
  Rationale: Route editing needs a reversible construction workflow.
- **REQ-14:** When a user invokes Finish or presses Enter while drawing, Route MUST retain the route in viewing mode.
  Rationale: Finishing releases the canvas for normal navigation.
- **REQ-15:** When a user invokes Edit, Route MUST return the retained route to waypoint editing mode.
  Rationale: Finished routes remain editable.
- **REQ-16:** When Escape is pressed during route editing, Route MUST exit editing while retaining the route.
  Rationale: Escape releases the tool without discarding work.
- **REQ-17:** When a user invokes Reverse, Route MUST reverse the traversal order.
  Rationale: Direction affects elevation difference, ascent, descent, and climb highlighting.
- **REQ-18:** When a user invokes Clear, Route MUST remove the active route.
  Rationale: Users need an explicit way to discard a route.
- **REQ-19:** When a new drawing or GPX import would replace an active route, the editor MUST request replacement confirmation before discarding it.
  Rationale: The first release supports one active route without silent data loss.

### Analysis and profile

- **REQ-20:** When a route has two or more points, Route MUST present ground distance as its primary distance.
  Rationale: Horizontal map distance is the chosen default.
- **REQ-21:** When route elevation coverage is complete, Route MUST present terrain-following distance separately from ground distance.
  Rationale: Surface travel incorporates vertical changes without obscuring map distance.
- **REQ-22:** When route elevation coverage is complete, Route MUST display total ascent, total descent, and signed endpoint elevation difference.
  Rationale: Cumulative climbing and net elevation change answer different questions.
- **REQ-23:** When route analysis is available, the editor MUST provide a collapsible elevation profile against cumulative ground distance.
  Rationale: The profile exposes the shape of the journey.
- **REQ-24:** On desktop, the editor MUST place the route profile below the viewport.
  Rationale: Keep the profile adjacent to the landscape.
- **REQ-25:** On mobile, the editor MUST place the route profile within the bottom sheet.
  Rationale: Reuse the established mobile interaction pattern.
- **REQ-26:** When a profile position is inspected by pointer, touch, or keyboard, the editor MUST highlight its corresponding terrain location.
  Rationale: Users need to connect a profile feature to its geographical position.
- **REQ-27:** The editor MUST default the steep-section threshold to 15% grade.
  Rationale: Provide immediate highlighting without initial configuration.
- **REQ-28:** When a user changes the steep-section threshold, the editor MUST accept values from 1% through 100% inclusive.
  Rationale: Users can adapt the threshold to their exploration.
- **REQ-29:** When absolute grade reaches the configured threshold, the editor MUST distinguish uphill and downhill sections using colour and text labels.
  Rationale: Direction and steepness must remain understandable without colour alone.
- **REQ-30:** When a route is reversed, the editor MUST recalculate direction-dependent analysis before presenting the reversed route's results.
  Rationale: Labels and statistics must describe the current traversal order.
- **REQ-31:** If route elevation coverage is incomplete, the profile MUST show gaps at uncovered sections.
  Rationale: Connecting across gaps would invent terrain information.
- **REQ-32:** If route elevation coverage is incomplete, the editor MUST label terrain-derived aggregates as partial.
  Rationale: Covered-section totals must not imply complete route coverage.
- **REQ-33:** When analysing an imported GPX route, the editor MUST label profile elevations and derived statistics as terrain-derived.
  Rationale: Terrain analysis is distinct from elevations recorded in the file.
- **REQ-34:** When importing GPX, the editor MUST preserve its recorded elevations separately from terrain-derived elevations.
  Rationale: Analysis must not overwrite the user's source data.

### Rendering and lifecycle

- **REQ-35:** While a route is visible in 3D, the editor MUST draw it against the displayed terrain surface in smooth and terraced modes.
  Rationale: The route follows the visible model while analysis remains tied to source elevations.
- **REQ-36:** When switching between 2D and 3D, the editor MUST retain the route's geographic coordinates.
  Rationale: Both views represent the same route.
- **REQ-37:** When the loaded terrain location changes, the editor MUST recalculate route coverage and analysis against the new dataset.
  Rationale: Retained routes must not display results from a previous terrain location.
- **REQ-38:** While fewer than two route points exist, the editor MUST identify the route as incomplete.
  Rationale: A single point has no route distance or elevation profile.

### Persistence and export

- **REQ-39:** When saving a design with a route, the Library MUST retain route geometry, provenance, slope threshold, and real-terrain location/span.
  Rationale: Reopening needs both the route and its terrain context.
- **REQ-40:** When reopening a saved route design, the editor MUST restore its terrain context before calculating route analysis.
  Rationale: Analysis must use the restored terrain rather than the previous scene.
- **REQ-41:** When opening an older saved design without route data, the Library MUST preserve its existing restoration behaviour.
  Rationale: Optional route support must not invalidate existing Library entries.
- **REQ-42:** When exporting a drawn route, the editor MUST produce a GPX track containing named waypoints and available terrain-derived elevations.
  Rationale: Drawn routes should be reusable outside LANDCU.BE.
- **REQ-43:** When exporting an imported GPX route, the editor MUST preserve recorded elevations instead of substituting terrain-derived elevations.
  Rationale: Export must respect the imported elevation source.
- **REQ-44:** The editor MUST preserve version-one design-link behaviour without adding route state to those URLs.
  Rationale: Existing links depend on stable serialization and terrain semantics.
- **REQ-45:** When exporting an STL, the editor MUST exclude route overlay geometry.
  Rationale: Route analysis is a preview feature rather than a change to printable terrain.

## Acceptance criteria

Each scenario corresponds to the identically numbered requirement. Numeric fixtures use known synthetic elevation samples to test real-terrain analysis independently of tile availability.

| Requirement | Given                                                            | When                                                                                     | Then                                                                                                                      |
| ----------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| REQ-1       | Real terrain and Measure active                                  | Two endpoints are placed                                                                 | A straight line joins exactly two endpoint markers.                                                                       |
| REQ-2       | Two known geographic endpoints                                   | The measurement is displayed                                                             | Horizontal distance and bearing match the geographic fixture.                                                             |
| REQ-3       | Endpoint elevations of 100 m and 350 m                           | The measurement is displayed                                                             | Both elevations appear in metres.                                                                                         |
| REQ-4       | Start 100 m and end 350 m                                        | The measurement is displayed                                                             | Elevation difference is +250 m.                                                                                           |
| REQ-5       | Fixed coordinates with complete source coverage                  | Exaggeration, terraces, clipping, crop, dimensions, and camera pose change independently | Terrain analysis values remain unchanged.                                                                                 |
| REQ-6       | A placed measurement                                             | The camera orbits                                                                        | Markers stay attached to their original terrain coordinates.                                                              |
| REQ-7       | One endpoint outside source coverage                             | Elevations are requested                                                                 | The missing elevation is unavailable rather than zero.                                                                    |
| REQ-8       | Procedural terrain                                               | A basic measurement is drawn                                                             | Existing nominal distance and bearing behaviour is retained.                                                              |
| REQ-9       | Real terrain on desktop and mobile                               | Tool controls are opened                                                                 | Route is offered alongside Measure in both layouts.                                                                       |
| REQ-10      | An empty route                                                   | Three waypoints are placed                                                               | Two direct segments connect them in placement order without following trails.                                             |
| REQ-11      | A route with three waypoints                                     | The middle waypoint is dragged                                                           | Its position and adjacent segments update.                                                                                |
| REQ-12      | A route segment                                                  | A point is inserted on that segment                                                      | The new point lies between its endpoints in route order.                                                                  |
| REQ-13      | A selected middle waypoint                                       | Delete is invoked                                                                        | The point disappears and its neighbours become adjacent.                                                                  |
| REQ-14      | A route being drawn                                              | Finish or Enter is invoked in separate runs                                              | The route remains visible and drawing ends.                                                                               |
| REQ-15      | A finished route                                                 | Edit is invoked                                                                          | Waypoint editing becomes available.                                                                                       |
| REQ-16      | A route being edited                                             | Escape is pressed                                                                        | Editing ends and the route remains.                                                                                       |
| REQ-17      | Waypoints A, B, C                                                | Reverse is invoked                                                                       | Traversal order becomes C, B, A.                                                                                          |
| REQ-18      | An active route                                                  | Clear is invoked                                                                         | The route and its analysis disappear.                                                                                     |
| REQ-19      | An active route                                                  | New route or GPX import is requested                                                     | Replacement requires confirmation; cancelling retains the original route.                                                 |
| REQ-20      | A route with two points                                          | Its summary is displayed                                                                 | Ground distance is the primary distance readout.                                                                          |
| REQ-21      | A 100 m horizontal segment rising 75 m                           | Route analysis completes                                                                 | Ground distance is 100 m and terrain-following distance is 125 m.                                                         |
| REQ-22      | Sample elevations 100 m, 150 m, 120 m                            | Route analysis completes                                                                 | Ascent is 50 m, descent is 30 m, and endpoint difference is +20 m.                                                        |
| REQ-23      | An analysed route                                                | The profile is expanded then collapsed                                                   | Distance/elevation axes appear, then the profile closes without removing the route.                                       |
| REQ-24      | A desktop viewport                                               | The profile opens                                                                        | It appears below the viewport.                                                                                            |
| REQ-25      | A phone viewport                                                 | The profile opens                                                                        | It appears within the bottom sheet.                                                                                       |
| REQ-26      | A known point on the profile                                     | It is inspected using pointer, touch, and keyboard separately                            | The corresponding geographical point is highlighted in each case.                                                         |
| REQ-27      | A new route with no stored threshold                             | Slope analysis is shown                                                                  | The threshold control reads 15%.                                                                                          |
| REQ-28      | The threshold control                                            | Values 1%, 15%, and 100% are entered                                                     | Each is accepted; values below 1% or above 100% are rejected.                                                             |
| REQ-29      | Sections with grades +15%, -15%, and +10% at a 15% threshold     | Highlighting is shown                                                                    | The first two are distinguished as steep climb/descent using colour and text; the third is not steep.                     |
| REQ-30      | A route with ascent 50 m, descent 30 m, and net +20 m            | Reverse is invoked                                                                       | Results become ascent 30 m, descent 50 m, and net -20 m with reversed climb/descent labels.                               |
| REQ-31      | A route crossing an uncovered area                               | The profile is displayed                                                                 | A gap replaces the uncovered section.                                                                                     |
| REQ-32      | A partly covered route                                           | Its summary is displayed                                                                 | Terrain-derived totals are marked partial and exclude uncovered spans.                                                    |
| REQ-33      | Imported GPX with recorded heights differing from terrain        | Its profile opens                                                                        | Profile and analysed statistics are labelled terrain-derived.                                                             |
| REQ-34      | An imported point recording 120 m above terrain sampled at 100 m | Analysis runs                                                                            | The recorded 120 m remains intact alongside terrain analysis.                                                             |
| REQ-35      | A visible route on covered terrain                               | Smooth and terraced modes are selected separately                                        | The route follows the displayed surface in each mode without disappearing.                                                |
| REQ-36      | A route in 2D                                                    | The editor switches to 3D and back                                                       | Geographic point order and coordinates are unchanged.                                                                     |
| REQ-37      | A retained route with current analysis                           | A different terrain location finishes loading                                            | Coverage and terrain-derived results reflect the new dataset.                                                             |
| REQ-38      | Zero or one route point                                          | The route UI is displayed                                                                | It reports an incomplete route instead of presenting a completed profile.                                                 |
| REQ-39      | A route with a nondefault threshold                              | Its design is saved                                                                      | The Library entry retains geometry, provenance, threshold, and terrain location/span.                                     |
| REQ-40      | A saved route at location A and a current scene at B             | The saved design is opened                                                               | Location A is restored before route analysis is presented.                                                                |
| REQ-41      | A pre-feature Library entry                                      | It is opened                                                                             | It restores without requiring route fields.                                                                               |
| REQ-42      | A drawn route with covered and uncovered points                  | GPX export is downloaded                                                                 | It parses as a track with named waypoints, available terrain elevations, and no invented elevations for uncovered points. |
| REQ-43      | Imported GPX with recorded elevations                            | GPX is exported after terrain analysis                                                   | Recorded elevations remain unchanged; missing recorded elevations are not filled from terrain.                            |
| REQ-44      | A known version-one design link                                  | Route features are used and the design is shared                                         | Version-one reproduction is unchanged and the URL contains no route data.                                                 |
| REQ-45      | A model with a visible route                                     | STL is exported with the route visible and hidden                                        | Printable geometry is identical.                                                                                          |

## Technical design handoff

These are implementation directions from the approved plan, separate from product requirements.

- Expose a metre-valued sampler, coverage bounds, and resolution metadata from the source elevation dataset. Preserve source heights before display clipping without changing legacy rendering semantics.
- Share analysis between drawn and imported routes; separate source geometry, recorded elevations, terrain samples, and projected display geometry. Preserve the original imported data independently of rendering simplification.
- Sample each segment at spacing no finer than source resolution or 10 m. Increase spacing to target approximately 10,000 samples across a route, retaining waypoint samples. The technical design must reconcile that target with inputs containing more than 10,000 original points.
- Calculate grade over a centred window of at least 50 m or two sample intervals, using a one-sided window at endpoints. Do not bridge coverage gaps. Ascent/descent and surface distance use the sampled elevation profile; display accuracy is bounded by source resolution.
- Cache analysis by route geometry and source dataset revision. Coalesce waypoint dragging to one update per animation frame; camera movement only updates projection.
- Implement a display path that follows smooth and terraced surfaces with a visual offset to avoid flicker. Analytical heights remain independent of the visual path.
- Use optional, versioned route data in saved designs. Persist source geometry and settings rather than derived profile samples. Recompute after restoring terrain.
- Keep numerical tests deterministic. Browser tests verify editing, rendering, profile inspection, persistence, and export without requiring a particular GPU frame rate.

### Engineering assumptions to confirm during technical design

The accepted plan proposes these starting parameters; this PRD does not treat them as validated performance or accuracy guarantees:

- Minimum analysis spacing: 10 m, bounded by the source dataset's resolution.
- Profile sample target: approximately 10,000 samples per route, subject to retaining original waypoints.
- Grade window: at least 50 m or two analysis sample intervals.
- Exact numerical tolerances, route-size limits, display rounding, and analysis latency budgets remain technical-design work. They need explicit fixture-based acceptance thresholds before implementation is considered complete.

## Out of scope

- Trail snapping, pathfinding, turn-by-turn navigation, or a routing service.
- Elevation-aware route analysis on procedural terrain.
- Multiple simultaneously active routes.
- Cloud accounts, route collaboration, or route data in version-one design URLs.
- CLI route editing or analysis.
- Adding route geometry to STL exports.
- Replacing imported recorded GPX elevations with terrain-derived elevations.
- Automatic terrain downloads beyond the selected location/span to complete a route profile.

## Open questions

- **OQ-1 — Engineering:** What maximum input size and sample strategy reconcile the profile sample target with large imported tracks while preserving original GPX data?
- **OQ-2 — Engineering:** What numerical tolerances and latency budgets pass on supported desktop and mobile devices for the selected sampling strategy?

No unresolved product choice blocks the agreed scope. The defaults of ground-distance-first presentation, a 15% adjustable grade threshold, real-terrain-only analysis, Library saving, GPX export, and imported-route support were approved in the planning discussion.

## Glossary

- **Source elevation:** Elevation in metres from the loaded dataset after existing data repair and before display-specific transformations.
- **Terrain analysis:** Measurements derived from source coordinates and source elevations rather than rendered geometry.
- **Ground distance:** Horizontal geographic distance accumulated along the ordered route segments.
- **Terrain-following distance:** Distance accumulated along sampled segments using horizontal travel and elevation change.
- **Elevation difference:** End elevation minus start elevation; signed according to traversal order.
- **Ascent / descent:** Sums of positive / negative sampled elevation changes, reported as nonnegative magnitudes.
- **Grade:** Signed elevation change divided by horizontal distance, expressed as a percentage over the analysis window.
- **Waypoint:** An ordered user-editable point defining a drawn route; imported named GPX waypoints remain source annotations.
- **Coverage gap:** A route section for which the loaded terrain dataset supplies no source elevation.
- **Provenance:** Whether a route was drawn or imported, together with the distinction between recorded and terrain-derived elevations.
