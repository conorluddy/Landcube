import type { ReactNode } from 'react';
import { GlassPanel } from './glass-panel';
import {
  SectionRail,
  formatSectionIndex,
  type RailSection,
  type SectionRailOrientation,
} from './section-rail';

export interface InspectorPanelProps<T extends string> {
  /** DOM id of the aside, for the footer toggle's aria-controls. */
  id: string;
  /** Names the complementary landmark. */
  label: string;
  /** Names the section rail's navigation landmark. */
  railLabel: string;
  sections: readonly RailSection<T>[];
  activeSectionId: T;
  onSelectSection: (id: T) => void;
  hiddenSectionIds?: readonly T[];
  /** Collapsed hides the panel body and keeps the rail visible and operable. */
  isCollapsed: boolean;
  /** Mono tag at the right of the header, e.g. the terrain source. */
  headerTag?: string;
  /** 'horizontal' turns the rail into the mobile tab strip above the body. */
  railOrientation?: SectionRailOrientation;
  /** Called for every section, hidden or not, so section state survives tab switches. */
  renderSection: (id: T) => ReactNode;
  /** Replaces the active section's header, e.g. while the body shows search results. */
  header?: InspectorHeader;
  /** Pinned to the bottom of the vertical rail, e.g. a keyboard hint. */
  railFooter?: ReactNode;
  /** The section the rail shows pressed when it differs from the body's; null for none. */
  railSelectionId?: T | null;
}

export interface InspectorHeader {
  index: string;
  title: string;
  tag?: string;
}

/**
 * Glass inspector (C-02): section rail, then a header (index / count, title, tag) over a
 * scrolling body with one labelled `section#inspector-{id}` per section.
 */
export function InspectorPanel<T extends string>({
  id,
  label,
  railLabel,
  sections,
  activeSectionId,
  onSelectSection,
  hiddenSectionIds = [],
  isCollapsed,
  headerTag,
  railOrientation = 'vertical',
  renderSection,
  header,
  railFooter,
  railSelectionId = activeSectionId,
}: InspectorPanelProps<T>): React.JSX.Element {
  const activeSection = sections.find((section) => section.id === activeSectionId);
  const shownHeader: InspectorHeader | undefined =
    header ??
    (activeSection && {
      index: `${formatSectionIndex(activeSection.index)} / ${formatSectionIndex(sections.length)}`,
      title: activeSection.title,
      tag: headerTag,
    });

  return (
    <GlassPanel
      as="aside"
      id={id}
      label={label}
      padding="none"
      className="lc-inspector"
      dataAttributes={{
        'data-collapsed': String(isCollapsed),
        'data-rail-orientation': railOrientation,
      }}
    >
      <SectionRail
        label={railLabel}
        sections={sections}
        activeSectionId={railSelectionId}
        onSelectSection={onSelectSection}
        hiddenSectionIds={hiddenSectionIds}
        orientation={railOrientation}
        getPanelId={getInspectorSectionId}
      />
      {railFooter !== undefined && <div className="lc-inspector__rail-footer">{railFooter}</div>}
      <div className="lc-inspector__panel" hidden={isCollapsed}>
        {shownHeader !== undefined && (
          <div className="lc-inspector__header">
            <span className="lc-inspector__index" aria-hidden="true">
              {shownHeader.index}
            </span>
            <h2 className="lc-inspector__title">{shownHeader.title}</h2>
            {shownHeader.tag !== undefined && (
              <span className="lc-inspector__tag">{shownHeader.tag}</span>
            )}
          </div>
        )}
        <div className="lc-inspector__body">
          {sections.map((section) => (
            <section
              key={section.id}
              id={getInspectorSectionId(section.id)}
              className="lc-inspector__section"
              aria-label={`${section.title} settings`}
              hidden={section.id !== activeSectionId || hiddenSectionIds.includes(section.id)}
            >
              {renderSection(section.id)}
            </section>
          ))}
        </div>
      </div>
    </GlassPanel>
  );
}

/** `inspector-model` for 'Model': the id e2e tests and the rail's aria-controls bind to. */
export function getInspectorSectionId(sectionId: string): string {
  return `inspector-${sectionId.toLowerCase()}`;
}
