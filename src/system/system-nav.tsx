import { Fragment } from 'react';
import { GroupHeader } from '../ui/group-header';
import { InspectorPanel, type InspectorHeader } from '../ui/inspector-panel';
import { PartRow } from '../ui/part-row';
import { StatusMessage } from '../ui/status-message';
import { formatCount, groupParts, type PartGroup } from './part-search';
import type { CodedPart, SystemSection, SystemSectionId } from './registry.types';
import { countPlates } from './specimen-catalogue';

/**
 * The flipped inspector: the section rail, then the parts of the active section in their groups.
 * While searching, the body lists every hit grouped by section instead.
 */
export function SystemNav({
  sections,
  parts,
  activeSectionId,
  activePartId,
  hits,
  query,
  onSelectSection,
  onSelectPart,
}: {
  sections: readonly SystemSection[];
  parts: readonly CodedPart[];
  activeSectionId: SystemSectionId;
  activePartId: string;
  /** Undefined while the Find field is blank. */
  hits: readonly CodedPart[] | undefined;
  query: string;
  onSelectSection: (id: SystemSectionId) => void;
  onSelectPart: (id: string) => void;
}): React.JSX.Element {
  const sectionParts = parts.filter((part) => part.section === activeSectionId);
  const header: InspectorHeader | undefined =
    hits === undefined
      ? undefined
      : {
          index: 'Find',
          title: 'Results',
          tag: `${String(hits.length)} ${hits.length === 1 ? 'match' : 'matches'}`,
        };
  const groups =
    hits === undefined
      ? groupParts(sectionParts, (part) => part.group)
      : groupParts(hits, (part) => sectionTitle(sections, part.section));

  return (
    <InspectorPanel
      id="system-inspector"
      label="Design system parts"
      railLabel="Design system section"
      sections={sections}
      activeSectionId={activeSectionId}
      railSelectionId={hits === undefined ? activeSectionId : null}
      onSelectSection={onSelectSection}
      isCollapsed={false}
      headerTag={`${formatCount(sectionParts.length)} parts`}
      header={header}
      railFooter={
        <>
          ↑ ↓
          <br />
          Browse
        </>
      }
      renderSection={(sectionId) =>
        sectionId === activeSectionId && (
          <>
            {groups.map((group) => (
              <PartList
                key={group.title}
                group={group}
                activePartId={activePartId}
                onSelectPart={onSelectPart}
              />
            ))}
            {hits?.length === 0 && (
              <p className="system-nav__empty">No parts match “{query.trim()}”.</p>
            )}
            <div className="system-nav__open">
              <GroupHeader title="Open · Rev B" />
              <StatusMessage kind="fault" code="Not yet designed">
                Dropdown select, colour picker, toasts. Motion is provisional.
              </StatusMessage>
            </div>
          </>
        )
      }
    />
  );
}

function PartList({
  group,
  activePartId,
  onSelectPart,
}: {
  group: PartGroup;
  activePartId: string;
  onSelectPart: (id: string) => void;
}): React.JSX.Element {
  return (
    <Fragment>
      <GroupHeader title={group.title} trailing={formatCount(group.parts.length)} />
      <ul className="system-nav__list">
        {group.parts.map((part) => (
          <li key={part.id}>
            <PartRow
              code={part.code}
              name={part.name}
              count={formatCount(countPlates(part))}
              isActive={part.id === activePartId}
              onSelect={() => {
                onSelectPart(part.id);
              }}
            />
          </li>
        ))}
      </ul>
    </Fragment>
  );
}

// === HELPERS ===

function sectionTitle(sections: readonly SystemSection[], id: SystemSectionId): string {
  return sections.find((section) => section.id === id)?.title ?? id;
}
