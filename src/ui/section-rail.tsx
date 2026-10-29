import { useRef } from 'react';

/** Vertical: the desktop inspector rail (C-03). Horizontal: the mobile tab strip (C-04). */
export type SectionRailOrientation = 'vertical' | 'horizontal';

export interface RailSection<T extends string> {
  id: T;
  /** 1-based display index, drawn as "01" above the title. */
  index: number;
  /** Four-letter section code, e.g. 'TERR'. */
  code: string;
  title: string;
}

export interface SectionRailProps<T extends string> {
  /** Accessible name of the navigation landmark. */
  label: string;
  sections: readonly RailSection<T>[];
  activeSectionId: T;
  onSelectSection: (id: T) => void;
  /** Left out of the rail; the others keep their index, so the numbering shows a gap. */
  hiddenSectionIds?: readonly T[];
  orientation?: SectionRailOrientation;
  /** The id of the panel each button controls. */
  getPanelId?: (id: T) => string;
}

const previousKeys = { vertical: 'ArrowUp', horizontal: 'ArrowLeft' } as const;
const nextKeys = { vertical: 'ArrowDown', horizontal: 'ArrowRight' } as const;

/**
 * Numbered section buttons. The index is drawn by CSS from `data-index`, so a button's text and
 * accessible name stay the bare title ("Model"). Arrow keys, Home and End move focus.
 */
export function SectionRail<T extends string>({
  label,
  sections,
  activeSectionId,
  onSelectSection,
  hiddenSectionIds = [],
  orientation = 'vertical',
  getPanelId,
}: SectionRailProps<T>): React.JSX.Element {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const visibleSections = sections.filter((section) => !hiddenSectionIds.includes(section.id));
  const tabStopIndex = Math.max(
    visibleSections.findIndex((section) => section.id === activeSectionId),
    0,
  );

  const moveFocus = (event: React.KeyboardEvent<HTMLElement>): void => {
    const focusedIndex = buttonRefs.current.findIndex((button) => button === event.target);
    const targetIndex = findTargetIndex(
      event.key,
      orientation,
      focusedIndex,
      visibleSections.length,
    );

    if (focusedIndex < 0 || targetIndex === undefined) {
      return;
    }

    event.preventDefault();
    buttonRefs.current[targetIndex]?.focus();
  };

  return (
    <nav
      className="lc-section-rail"
      aria-label={label}
      data-orientation={orientation}
      onKeyDown={moveFocus}
    >
      {visibleSections.map((section, position) => (
        <button
          key={section.id}
          ref={(element) => {
            buttonRefs.current[position] = element;
          }}
          type="button"
          className="lc-section-rail__item"
          data-index={formatSectionIndex(section.index)}
          data-code={section.code}
          aria-label={section.title}
          aria-pressed={section.id === activeSectionId}
          aria-controls={getPanelId?.(section.id)}
          tabIndex={position === tabStopIndex ? 0 : -1}
          onClick={() => {
            onSelectSection(section.id);
          }}
        >
          <span className="lc-section-rail__title">{section.title}</span>
        </button>
      ))}
    </nav>
  );
}

/** "01" for 1: the rail, the inspector header and specimens share this format. */
export function formatSectionIndex(index: number): string {
  return String(index).padStart(2, '0');
}

// === HELPERS ===

function findTargetIndex(
  key: string,
  orientation: SectionRailOrientation,
  focusedIndex: number,
  count: number,
): number | undefined {
  if (key === previousKeys[orientation]) {
    return (focusedIndex - 1 + count) % count;
  }

  if (key === nextKeys[orientation]) {
    return (focusedIndex + 1) % count;
  }

  if (key === 'Home') {
    return 0;
  }

  return key === 'End' ? count - 1 : undefined;
}
