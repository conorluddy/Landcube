import { useEffect, useState } from 'react';
import './system.css';
import { findParts, stepPart } from './part-search';
import { findPartById, systemParts, systemSections } from './registry';
import type { SystemSectionId } from './registry.types';
import { SystemFooter, SystemHeader, SystemHud } from './system-chrome';
import { SystemNav } from './system-nav';
import { SystemStage } from './system-stage';
import { countPlates } from './specimen-catalogue';

export interface SystemModeProps {
  /** The part on the stage; an unknown id shows the first part. */
  partId: string;
  onSelectPart: (id: string) => void;
  /** Flips back to the studio. */
  onExit: () => void;
}

/**
 * Design-system mode's chrome and stage, as direct children of the studio shell so they take the
 * studio's positions: header, stage, HUD, the flipped inspector and footer. Lazy-loaded.
 */
export default function SystemMode({
  partId,
  onSelectPart,
  onExit,
}: SystemModeProps): React.JSX.Element {
  const part = findPartById(partId) ?? systemParts[0];
  const [navSectionId, setNavSectionId] = useState<SystemSectionId>(part.section);
  const [query, setQuery] = useState('');
  const hits = query.trim() === '' ? undefined : findParts(systemParts, query);
  const section = systemSections.find(({ id }) => id === part.section) ?? systemSections[0];
  const position = systemParts.indexOf(part) + 1;

  // Stepping across a section boundary takes the nav along with it.
  useEffect(() => {
    setNavSectionId(part.section);
  }, [part.section]);

  useEffect(() => {
    const browse = (event: KeyboardEvent) => {
      const delta = arrowKeySteps[event.key];

      if (delta === undefined || event.defaultPrevented || isTypingTarget(event.target)) {
        return;
      }

      event.preventDefault();
      onSelectPart(stepPart(systemParts, part.id, delta).id);
    };

    document.addEventListener('keydown', browse);

    return () => {
      document.removeEventListener('keydown', browse);
    };
  }, [part.id, onSelectPart]);

  return (
    <>
      <SystemHeader
        part={part}
        section={section}
        query={query}
        matchCount={hits?.length}
        onQueryChange={setQuery}
        onExit={onExit}
      />
      <SystemHud part={part} plateCount={countPlates(part)} />
      <SystemStage
        part={part}
        section={section}
        previousPart={stepPart(systemParts, part.id, -1)}
        nextPart={stepPart(systemParts, part.id, 1)}
        onSelectPart={onSelectPart}
      />
      <SystemNav
        sections={systemSections}
        parts={systemParts}
        activeSectionId={navSectionId}
        activePartId={part.id}
        hits={hits}
        query={query}
        onSelectSection={(id) => {
          setNavSectionId(id);
          setQuery('');
        }}
        onSelectPart={onSelectPart}
      />
      <SystemFooter
        position={position}
        partCount={systemParts.length}
        sectionCount={systemSections.length}
        onStep={(delta) => {
          onSelectPart(stepPart(systemParts, part.id, delta).id);
        }}
        onExit={onExit}
      />
    </>
  );
}

// === HELPERS ===

const arrowKeySteps: Partial<Record<string, 1 | -1>> = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
};

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}
