import type { SignalMarkAccent } from '../ui/signal-mark';

// === SECTIONS ===

export type SystemSectionId = 'FNDN' | 'PRIM' | 'COMP' | 'OVLY' | 'LYOT';

/** A rail section; shaped as a `RailSection` so the inspector rail can render it directly. */
export interface SystemSection {
  id: SystemSectionId;
  index: number;
  code: SystemSectionId;
  title: string;
  /** The rail shows the code; the title stays the accessible name. */
  shortTitle: SystemSectionId;
}

// === PARTS ===

/** One SPEC table row. Without `value`, the live value of `token` is shown, so it can't drift. */
export interface SpecRow {
  property: string;
  value?: string;
  token?: string;
}

interface PartBase {
  /** Stable id for links (`?part=`) and plate state. */
  id: string;
  section: SystemSectionId;
  /** Nav group within the section, e.g. 'Inputs'. */
  group: string;
  name: string;
  summary: string;
  /** Reference screen codes from the design handoff, e.g. '1 · 3F · 3G'. */
  usedIn?: string;
  spec: SpecRow[];
}

/** A `src/ui` component: its plates are the `defineSpecimens` entries named `component`. */
export interface ComponentPart extends PartBase {
  kind: 'component';
  component: string;
  /**
   * Plate keys (`variant/size/state`, e.g. 'primary/hover') to show, in this order, when the full
   * specimen set is mostly edge cases. Omitted shows every specimen.
   */
  plates?: readonly string[];
}

/** Tokens rather than components: plates are drawn from `cells`, reading live token values. */
export interface FoundationPart extends PartBase {
  kind: 'foundation';
  /** Token family for the source tag, e.g. '--lc-ink-*'. */
  source: string;
  cells: FoundationCell[];
}

/** Shell layouts: diagrams of the desktop frame and a scaled phone built from real components. */
export interface LayoutPart extends PartBase {
  kind: 'layout';
  /** Where the layout lives, e.g. 'src/studio/studio.css'. */
  source: string;
  cells: LayoutCell[];
}

export type SystemPart = ComponentPart | FoundationPart | LayoutPart;

/** A part with its section code assigned in registry order, e.g. 'PRIM.04'. */
export type CodedPart = SystemPart & { code: string };

// === FOUNDATION CELLS ===

interface CellCaption {
  label: string;
  /** Right-hand caption; most cells default it to the live token value. */
  note?: string;
}

export interface TypeScaleRow {
  role: string;
  sizeToken: string;
  family: 'sans' | 'mono';
  weight: 300 | 400 | 500;
  /** A CSS letter-spacing value, usually a `--lc-track-*` var. */
  tracking: string;
  sample: string;
}

export type FoundationCell = CellCaption &
  (
    | { k: 'swatch'; token: string }
    | { k: 'textRole'; token: string; isOnBone?: boolean }
    | { k: 'line'; borderToken?: string; fillToken?: string }
    | { k: 'glass'; token: string; blurToken: string }
    | { k: 'shadow'; token: string }
    | { k: 'pattern'; token: string; isOnGlass?: boolean }
    | { k: 'typeScale'; rows: TypeScaleRow[] }
    | { k: 'radius'; token: string; isTopOnly?: boolean }
    | { k: 'space'; token: string }
    | { k: 'height'; token: string }
    | { k: 'signal'; accent: SignalMarkAccent }
    | { k: 'motion'; duration: string }
  );

export type FoundationKind = FoundationCell['k'];

// === LAYOUT CELLS ===

export type LayoutCell = CellCaption & ({ k: 'desktopShell' } | { k: 'mobileShell' });
