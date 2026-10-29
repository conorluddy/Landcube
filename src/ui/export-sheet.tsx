import { useRef, useState, type ReactNode } from 'react';
import { Button } from './button';
import { Checkbox } from './checkbox';
import { GroupHeader } from './group-header';
import { JobList, type ExportJob } from './job-list';
import { NumberField } from './number-field';
import { ReadoutCell, ReadoutGrid } from './readout-grid';
import { Segmented } from './segmented';
import { Select, type SelectOption } from './select';
import { StatusMessage } from './status-message';
import { Switch } from './switch';
import { Tag } from './tag';
import { TextField } from './text-field';

// === VIEW MODEL ===

export interface ExportAction {
  /** Also the accessible name, e.g. "Download SVG". */
  label: string;
  onClick: () => void;
  isDisabled?: boolean;
  isBusy?: boolean;
}

export interface ExportFault {
  code?: string;
  message: string;
}

export interface ExportNumberField {
  value: number;
  min: number;
  max: number;
  /** Return `false` to reject the value. */
  onChange: (value: number | undefined) => unknown;
}

export interface ExportModelFormat {
  id: string;
  label: string;
  /** Rendered disabled with a "Soon" tag. */
  isSoon: boolean;
}

export interface ExportPartRow {
  id: string;
  label: string;
  /** Right-aligned secondary text, such as the estimated file size. */
  detail?: string;
  isSelected: boolean;
  onSelectedChange: (isSelected: boolean) => void;
  download: ExportAction;
}

export interface ExportSheetModel {
  /** What is being exported: seed or location. */
  target: string;
  summary: readonly { label: string; value: string; unit?: string }[];
  /** The 2D image format. */
  format: {
    value: string;
    options: readonly { value: string; label: string }[];
    onChange: (value: string) => void;
  };
  fields: {
    size: {
      value: string;
      options: readonly SelectOption<string>[];
      onChange: (value: string) => void;
    };
    width: ExportNumberField;
    height: ExportNumberField;
    sizeHint: string;
    /** PNG only. */
    resolution?: { value: string; options: readonly string[]; onChange: (value: string) => void };
    isTransparent: { value: boolean; onChange: (value: boolean) => void };
    isExtraLargeAllowed: { value: boolean; onChange: (value: boolean) => void };
    extraLargeWarning?: string;
  };
  preview: { src?: string; alt: string; caption: string; onError: () => void };
  primaryAction: ExportAction;
  /** 3D view only. */
  still?: {
    scale: { value: string; options: readonly { value: string; label: string }[] };
    onScaleChange: (value: string) => void;
    hint: string;
    action: ExportAction;
  };
  /** 3D view only. */
  model?: {
    formats: readonly ExportModelFormat[];
    hints: readonly string[];
    action: ExportAction;
    notice?: string;
    parts?: readonly ExportPartRow[];
    partHints?: readonly string[];
    partsAction?: ExportAction;
    /**
     * Not consumed by any export yet: no engraving pipeline exists (open question in #94), so
     * the field renders disabled until one does.
     */
    plaqueText?: { value: string; onChange: (value: string) => void };
  };
  jobs?: readonly ExportJob[];
  faults: readonly ExportFault[];
  /** Real terrain only: the credit line and its text download. */
  attribution?: { text: string; action: ExportAction };
  /** The success sheet, shown after a download starts. */
  success?: ReactNode;
}

// === PUBLIC API ===

/** The export dialog body (C-19): summary, 2D image, 3D still and 3D model sections. */
export function ExportSheet({ model }: { model: ExportSheetModel }): React.JSX.Element {
  return (
    <div className="lc-export-sheet">
      <header className="lc-export-sheet__summary">
        <p className="lc-export-sheet__target">{model.target}</p>
        <ReadoutGrid>
          {model.summary.map((item) => (
            <ReadoutCell key={item.label} label={item.label} value={item.value} unit={item.unit} />
          ))}
        </ReadoutGrid>
      </header>
      <ImageSection model={model} />
      {model.still && <StillSection still={model.still} />}
      {model.model && <ModelSection model={model.model} jobs={model.jobs} />}
      {model.attribution && (
        <section className="lc-export-sheet__section">
          <GroupHeader title="Terrain credit" />
          <p className="lc-export-sheet__hint">{model.attribution.text}</p>
          <ActionButton action={model.attribution.action} />
        </section>
      )}
      {model.success}
    </div>
  );
}

// === SECTIONS ===

function ImageSection({ model }: { model: ExportSheetModel }): React.JSX.Element {
  const { fields, preview } = model;
  const fieldsRef = useRef<HTMLDivElement>(null);
  const [hasInvalidField, setHasInvalidField] = useState(false);

  return (
    <section className="lc-export-sheet__section">
      <GroupHeader title="2D image" />
      <p className="lc-export-sheet__hint">
        Exports settled 2D artwork. Cursor deformation and the 3D scene are excluded.
      </p>
      <Select
        label="Format"
        value={model.format.value}
        options={model.format.options}
        onChange={model.format.onChange}
        isPositionShown={false}
      />
      <Select
        label="Size"
        value={fields.size.value}
        options={fields.size.options}
        onChange={fields.size.onChange}
        isPositionShown={false}
      />
      <div
        className="lc-export-sheet__dimensions"
        ref={fieldsRef}
        onBlur={() => {
          requestAnimationFrame(() => {
            setHasInvalidField(fieldsRef.current?.querySelector('[aria-invalid="true"]') !== null);
          });
        }}
        onInput={() => {
          setHasInvalidField(true);
        }}
      >
        <NumberField label="Width" unit="px" step={1} {...fields.width} />
        <NumberField label="Height" unit="px" step={1} {...fields.height} />
      </div>
      <p className="lc-export-sheet__hint">{fields.sizeHint}</p>
      {fields.resolution && (
        <Select
          label="Resolution"
          value={fields.resolution.value}
          options={fields.resolution.options}
          onChange={fields.resolution.onChange}
          isPositionShown={false}
        />
      )}
      <Switch
        label="Transparent background"
        value={fields.isTransparent.value}
        onChange={fields.isTransparent.onChange}
      />
      <Switch
        label="Allow extra-large exports"
        value={fields.isExtraLargeAllowed.value}
        onChange={fields.isExtraLargeAllowed.onChange}
        description={fields.extraLargeWarning}
      />
      <div className="lc-export-sheet__preview">
        {preview.src !== undefined && (
          <img
            id="output-preview-image"
            src={preview.src}
            alt={preview.alt}
            onError={preview.onError}
          />
        )}
      </div>
      <p className="lc-export-sheet__hint">{preview.caption}</p>
      {model.faults.map((fault) => (
        <StatusMessage key={fault.message} kind="fault" code={fault.code} isAlert>
          {fault.message}
        </StatusMessage>
      ))}
      <ActionButton action={model.primaryAction} isDisabledOverride={hasInvalidField} />
    </section>
  );
}

function StillSection({
  still,
}: {
  still: NonNullable<ExportSheetModel['still']>;
}): React.JSX.Element {
  return (
    <section className="lc-export-sheet__section">
      <GroupHeader title="3D still" />
      <Segmented
        label="Scale"
        value={still.scale.value}
        options={still.scale.options}
        onChange={still.onScaleChange}
      />
      <p className="lc-export-sheet__hint">{still.hint}</p>
      <ActionButton action={still.action} />
    </section>
  );
}

function ModelSection({
  model,
  jobs,
}: {
  model: NonNullable<ExportSheetModel['model']>;
  jobs: ExportSheetModel['jobs'];
}): React.JSX.Element {
  return (
    <section className="lc-export-sheet__section">
      <GroupHeader title="3D model" />
      <div className="lc-export-sheet__formats" role="group" aria-label="3D model format">
        {model.formats.map((format) => (
          <button
            key={format.id}
            className="lc-export-sheet__format"
            type="button"
            aria-pressed={!format.isSoon}
            disabled={format.isSoon}
          >
            {format.label}
            {format.isSoon && <Tag variant="outlineMuted">Soon</Tag>}
          </button>
        ))}
      </div>
      {model.hints.map((hint) => (
        <p className="lc-export-sheet__hint" key={hint}>
          {hint}
        </p>
      ))}
      {model.notice !== undefined && <StatusMessage kind="info">{model.notice}</StatusMessage>}
      {model.parts && model.parts.length > 0 && (
        <div className="lc-export-sheet__parts">
          {model.parts.map((part) => (
            <Checkbox
              key={part.id}
              label={part.label}
              detail={part.detail}
              value={part.isSelected}
              onChange={part.onSelectedChange}
            />
          ))}
          {model.partHints?.map((hint) => (
            <p className="lc-export-sheet__hint" key={hint}>
              {hint}
            </p>
          ))}
        </div>
      )}
      {model.plaqueText && (
        <TextField
          label="Plaque text"
          value={model.plaqueText.value}
          onChange={model.plaqueText.onChange}
          isMonospace={false}
          disabled
        />
      )}
      <JobList jobs={jobs ?? []} label="Frame part downloads" />
      <div className="lc-export-sheet__actions" role="group" aria-label="STL downloads">
        <ActionButton action={model.action} />
        {model.parts?.map((part) => (
          <ActionButton key={part.id} action={part.download} isSecondary />
        ))}
        {model.partsAction && <ActionButton action={model.partsAction} isSecondary />}
      </div>
    </section>
  );
}

// === HELPERS ===

function ActionButton({
  action,
  isSecondary = false,
  isDisabledOverride = false,
}: {
  action: ExportAction;
  isSecondary?: boolean;
  isDisabledOverride?: boolean;
}): React.JSX.Element {
  return (
    <Button
      variant={isSecondary ? 'secondary' : 'primary'}
      disabled={action.isDisabled === true || isDisabledOverride}
      isBusy={action.isBusy}
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  );
}
