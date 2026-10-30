import { BrandLockup } from './brand-lockup';
import { Button } from './button';
import { ReadoutCell, ReadoutGrid } from './readout-grid';

// === VIEW MODEL ===

export interface ModelDossierView {
  title: string;
  subtitle: string;
  /** ISO 8601; formatted in UTC so the sheet reads the same wherever it is printed. */
  generatedAt: string;
  readouts: readonly { label: string; value: string; unit?: string }[];
  styleLink: string;
  /** Terrain credit, printed verbatim. Null for procedural landscapes. */
  attribution: string | null;
  roadsCredit: string | null;
  preview?: { src: string; alt: string };
  palette: readonly { label: string; color: string }[];
}

export interface ModelDossierProps {
  model: ModelDossierView;
  onPrint: () => void;
  onCopyLink: () => void;
}

// === PUBLIC API ===

/**
 * The printable model dossier sheet (C-22). On screen it is a white A4-proportioned page; under
 * `@media print` everything else on the page is hidden (see model-dossier.css).
 */
export function ModelDossier({ model, onPrint, onCopyLink }: ModelDossierProps): React.JSX.Element {
  return (
    <div className="lc-dossier-frame">
      <div className="lc-dossier-toolbar">
        <p className="lc-dossier-toolbar__hint">
          Prints on A4. Choose Letter in the print dialog if you need it; the sheet reflows.
        </p>
        <Button variant="primary" size="small" onClick={onPrint}>
          Print
        </Button>
      </div>
      <div className="lc-dossier" role="group" aria-label="Dossier sheet">
        <header className="lc-dossier__header">
          <BrandLockup context="Model dossier" isHeading={false} />
          <h3 className="lc-dossier__title">{model.title}</h3>
          <p className="lc-dossier__subtitle">{model.subtitle}</p>
        </header>
        {model.preview && (
          <img className="lc-dossier__preview" src={model.preview.src} alt={model.preview.alt} />
        )}
        <ReadoutGrid>
          {model.readouts.map((cell) => (
            <ReadoutCell key={cell.label} label={cell.label} value={cell.value} unit={cell.unit} />
          ))}
        </ReadoutGrid>
        <ul className="lc-dossier__palette" aria-label="Palette">
          {model.palette.map(({ label, color }) => (
            <li key={label} className="lc-dossier__swatch">
              <span className="lc-dossier__chip" style={{ backgroundColor: color }} />
              {label} {color.toUpperCase()}
            </li>
          ))}
        </ul>
        {(model.attribution !== null || model.roadsCredit !== null) && (
          <section className="lc-dossier__block" aria-label="Attribution">
            <h4 className="lc-dossier__label">Attribution</h4>
            {model.attribution !== null && <p className="lc-dossier__mono">{model.attribution}</p>}
            {model.roadsCredit !== null && <p className="lc-dossier__mono">{model.roadsCredit}</p>}
          </section>
        )}
        <section className="lc-dossier__block" aria-label="Style link">
          <h4 className="lc-dossier__label">Style link</h4>
          <p className="lc-dossier__mono lc-dossier__link">{model.styleLink}</p>
          <div className="lc-dossier__screen-only">
            <Button size="small" onClick={onCopyLink}>
              Copy
            </Button>
          </div>
        </section>
        <footer className="lc-dossier__footer">
          <span>Generated {formatGeneratedAt(model.generatedAt)}</span>
          <span>LANDCU.BE</span>
        </footer>
      </div>
    </div>
  );
}

// === HELPERS ===

const generatedAtFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'UTC',
});

function formatGeneratedAt(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);

  return Number.isNaN(date.getTime()) ? isoTimestamp : `${generatedAtFormat.format(date)} UTC`;
}
