import { Activity, useEffect, useRef, useState } from 'react';
import { GroupHeader } from '../ui/group-header';
import { GlassPanel } from '../ui/glass-panel';
import { Tag } from '../ui/tag';
import { specimenKey, type Specimen } from '../ui/specimens';
import { FoundationPlate } from './foundation-plates';
import { LayoutPlate } from './layout-plates';
import { formatCount, stepPart } from './part-search';
import { systemParts, systemSections } from './registry';
import { Plate } from './plate';
import type { CodedPart, SpecRow, SystemSection, SystemSectionId } from './registry.types';
import { countPlates, getComponentSpecimens, getPartSpecimens } from './specimen-catalogue';
import { useTokenValue } from './token-value';

const forceableStates = new Set(['hover', 'focus', 'active']);
const fadeOutMs = 140;

/**
 * The specimen book: one page per part, with the title block printed on the ground, the plates,
 * the spec table and prev / next. Fades out, swaps and scrolls to the top when the part changes.
 * Visited pages stay mounted but hidden (`Activity`), so a slider dragged on one part keeps its
 * value after browsing away and back.
 */
export function SystemStage({
  part,
  onSelectPart,
}: {
  part: CodedPart;
  onSelectPart: (id: string) => void;
}): React.JSX.Element {
  const stage = useRef<HTMLDivElement>(null);
  const [shownPart, setShownPart] = useState(part);
  const [visitedParts, setVisitedParts] = useState<readonly CodedPart[]>([part]);
  const isFadingOut = shownPart.id !== part.id;

  useEffect(() => {
    if (!isFadingOut) {
      return;
    }

    const timer = window.setTimeout(() => {
      setShownPart(part);
      setVisitedParts((visited) => (visited.includes(part) ? visited : [...visited, part]));
      stage.current?.scrollTo({ top: 0 });
    }, fadeOutMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isFadingOut, part]);

  return (
    <div
      ref={stage}
      className="system-stage"
      data-fading={isFadingOut ? 'true' : undefined}
      aria-label={`${shownPart.name} specimens`}
      role="region"
    >
      {visitedParts.map((visited) => (
        <Activity key={visited.id} mode={visited.id === shownPart.id ? 'visible' : 'hidden'}>
          <article className="system-stage__page">
            <StagePage
              part={visited}
              section={findSection(visited.section)}
              previousPart={stepPart(systemParts, visited.id, -1)}
              nextPart={stepPart(systemParts, visited.id, 1)}
              onSelectPart={onSelectPart}
            />
          </article>
        </Activity>
      ))}
    </div>
  );
}

// === PAGE ===

function StagePage({
  part,
  section,
  previousPart,
  nextPart,
  onSelectPart,
}: {
  part: CodedPart;
  section: SystemSection;
  previousPart: CodedPart;
  nextPart: CodedPart;
  onSelectPart: (id: string) => void;
}): React.JSX.Element {
  const component = part.kind === 'component' ? getComponentSpecimens(part.component) : undefined;
  const plateCount = countPlates(part);
  const source = component?.sourcePath ?? (part.kind === 'component' ? '' : part.source);

  return (
    <>
      <header className="system-title system-print">
        <p className="system-title__code">
          <span className="system-title__code-strong">{part.code}</span> / {section.title} /{' '}
          {part.group}
        </p>
        <h1 className="system-title__name">{part.name}</h1>
        <p className="system-title__summary">{part.summary}</p>
        <div className="system-title__tags">
          <Tag variant="outlineMuted">
            {component !== undefined && plateCount < component.specimens.length
              ? `${formatCount(plateCount)} of ${formatCount(component.specimens.length)} plates`
              : `${formatCount(plateCount)} plates`}
          </Tag>
          {part.usedIn !== undefined && (
            <Tag variant="outlineMuted">{`Used in ${part.usedIn}`}</Tag>
          )}
          <Tag variant="solidBone">{source}</Tag>
        </div>
      </header>
      <section className="system-stage__block system-print" aria-label="Specimens">
        <GroupHeader title="Specimens" trailing={`${part.code}.A`} />
      </section>
      <div className="system-plates">{renderPlates(part)}</div>
      {part.spec.length > 0 && (
        <>
          <div className="system-stage__block system-print">
            <GroupHeader title="Spec" trailing={`${part.code}.B`} />
          </div>
          <SpecTable rows={part.spec} />
        </>
      )}
      <nav className="system-steps" aria-label="Neighbouring parts">
        <StepButton direction="previous" part={previousPart} onSelectPart={onSelectPart} />
        <StepButton direction="next" part={nextPart} onSelectPart={onSelectPart} />
      </nav>
    </>
  );
}

function renderPlates(part: CodedPart): React.ReactNode {
  switch (part.kind) {
    case 'component':
      return getPartSpecimens(part).map((specimen) => (
        <SpecimenPlate
          key={specimenKey(specimen)}
          specimen={specimen}
          isFlush={part.section === 'OVLY'}
        />
      ));
    case 'foundation':
      return part.cells.map((cell, index) => (
        <FoundationPlate key={`${cell.k}-${cell.label}-${String(index)}`} cell={cell} />
      ));
    case 'layout':
      return part.cells.map((cell) => <LayoutPlate key={cell.k} cell={cell} />);
  }
}

function SpecimenPlate({
  specimen,
  isFlush,
}: {
  specimen: Specimen;
  isFlush: boolean;
}): React.JSX.Element {
  const state = specimen.state ?? '';

  return (
    <Plate
      label={specimen.variant}
      note={[specimen.size, specimen.state].filter(Boolean).join(' · ')}
      contentWidthPx={specimen.width}
      isFlush={isFlush}
      forcedState={forceableStates.has(state) ? state : undefined}
    >
      {specimen.render()}
    </Plate>
  );
}

// === SPEC ===

function SpecTable({ rows }: { rows: readonly SpecRow[] }): React.JSX.Element {
  return (
    <GlassPanel padding="none" className="system-spec">
      <table className="system-spec__table">
        <thead>
          <tr>
            <th scope="col">Property</th>
            <th scope="col">Value</th>
            <th scope="col">Token</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <SpecTableRow key={row.property} row={row} />
          ))}
        </tbody>
      </table>
    </GlassPanel>
  );
}

function SpecTableRow({ row }: { row: SpecRow }): React.JSX.Element {
  return (
    <tr>
      <th scope="row">{row.property}</th>
      <td className="system-spec__value">
        {row.value ?? (row.token === undefined ? '—' : <LiveTokenValue token={row.token} />)}
      </td>
      <td className="system-spec__token">{row.token ?? '—'}</td>
    </tr>
  );
}

function LiveTokenValue({ token }: { token: string }): string {
  return useTokenValue(token);
}

// === PREV / NEXT ===

function StepButton({
  direction,
  part,
  onSelectPart,
}: {
  direction: 'previous' | 'next';
  part: CodedPart;
  onSelectPart: (id: string) => void;
}): React.JSX.Element {
  const isNext = direction === 'next';

  return (
    <button
      type="button"
      className="system-step lc-glass"
      data-direction={direction}
      data-ui-surface
      onClick={() => {
        onSelectPart(part.id);
      }}
    >
      <span className="system-step__code">{isNext ? `${part.code} →` : `← ${part.code}`}</span>
      <span className="system-step__name">{part.name}</span>
    </button>
  );
}

function findSection(id: SystemSectionId): SystemSection {
  return systemSections.find((section) => section.id === id) ?? systemSections[0];
}
