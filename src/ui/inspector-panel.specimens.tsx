import { useState } from 'react';
import { InspectorPanel } from './inspector-panel';
import { specimenSections } from './section-rail.specimens';
import type { SectionRailOrientation } from './section-rail';
import { defineSpecimens } from './specimens';
import { StatusMessage } from './status-message';

function Demo({
  isCollapsed = false,
  railOrientation = 'vertical',
  headerTag = 'Src · EU-DEM',
}: {
  isCollapsed?: boolean;
  railOrientation?: SectionRailOrientation;
  headerTag?: string;
}): React.JSX.Element {
  const [active, setActive] = useState('terrain');

  return (
    <div style={{ display: 'grid', height: 360 }}>
      <InspectorPanel
        id={`specimen-inspector-${railOrientation}-${String(isCollapsed)}`}
        label="Landscape controls"
        railLabel="Editing section"
        sections={specimenSections}
        activeSectionId={active}
        onSelectSection={setActive}
        hiddenSectionIds={['model']}
        isCollapsed={isCollapsed}
        headerTag={headerTag}
        railOrientation={railOrientation}
        renderSection={(id) => (
          <StatusMessage kind="ok" code={id.toUpperCase()}>
            Section body for {id}.
          </StatusMessage>
        )}
      />
    </div>
  );
}

export default defineSpecimens('inspector-panel', [
  { variant: 'expanded', width: 396, render: () => <Demo /> },
  { variant: 'collapsed', width: 396, render: () => <Demo isCollapsed /> },
  {
    variant: 'expanded',
    state: 'long',
    width: 396,
    render: () => <Demo headerTag="Src · Produced using Copernicus data and information" />,
  },
  {
    variant: 'horizontal',
    width: 360,
    render: () => <Demo railOrientation="horizontal" />,
  },
  {
    variant: 'horizontal',
    state: 'collapsed',
    width: 360,
    render: () => <Demo railOrientation="horizontal" isCollapsed />,
  },
]);
