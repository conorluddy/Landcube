import { useEffect, useRef, useState } from 'react';
import './system.css';
import { isFindShortcut, isTextField, ownsArrowKeys, readBrowseStep } from './browse-keys';
import { findParts, stepPart } from './part-search';
import { findPartByCode, findPartById, systemParts, systemSections } from './registry';
import type { SystemSectionId } from './registry.types';
import { SystemFooter, SystemHeader, SystemHud } from './system-chrome';
import { SystemNav } from './system-nav';
import { SystemStage } from './system-stage';
import { countPlates } from './specimen-catalogue';

export interface SystemModeProps {
  /** The part on the stage, by id or code (from a link); an unknown one shows the first part. */
  partId: string;
  onSelectPart: (id: string) => void;
  /** Moves focus to the current part on entry, for keyboard users arriving from the studio. */
  isFocusedOnEntry: boolean;
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
  isFocusedOnEntry,
  onExit,
}: SystemModeProps): React.JSX.Element {
  const part = findPartById(partId) ?? findPartByCode(partId) ?? systemParts[0];
  const [navSectionId, setNavSectionId] = useState<SystemSectionId>(part.section);
  const [query, setQuery] = useState('');
  const findInput = useRef<HTMLInputElement>(null);
  const hits = query.trim() === '' ? undefined : findParts(systemParts, query);
  const section = systemSections.find(({ id }) => id === part.section) ?? systemSections[0];
  const position = systemParts.indexOf(part) + 1;

  // A link may name a part by code, or by nothing we know: settle on the id actually shown.
  useEffect(() => {
    if (part.id !== partId) {
      onSelectPart(part.id);
    }
  }, [part.id, partId, onSelectPart]);

  // Stepping across a section boundary takes the nav along with it.
  useEffect(() => {
    setNavSectionId(part.section);
  }, [part.section]);

  // The control that opened this mode unmounted with the studio chrome; keep keyboard users in place.
  useEffect(() => {
    const isFocusLost = document.activeElement === null || document.activeElement === document.body;

    if (isFocusedOnEntry && isFocusLost) {
      document
        .querySelector<HTMLElement>('#system-inspector .lc-part-row[aria-current="true"]')
        ?.focus();
    }
    // Entry only: later renders must not pull focus back.
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      if (isFindShortcut(event) && !(event.key === '/' && isTextField(event.target))) {
        event.preventDefault();
        findInput.current?.focus();
        findInput.current?.select();

        return;
      }

      const delta = readBrowseStep(event);

      if (delta === undefined || ownsArrowKeys(event.target)) {
        return;
      }

      event.preventDefault();
      onSelectPart(stepPart(systemParts, part.id, delta).id);
    };

    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [part.id, onSelectPart]);

  return (
    <>
      <SystemHeader
        part={part}
        section={section}
        query={query}
        findInputRef={findInput}
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
