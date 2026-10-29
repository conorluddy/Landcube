import { useState } from 'react';
import { SectionRail, type RailSection, type SectionRailOrientation } from './section-rail';
import { defineSpecimens } from './specimens';

/** Mirrors the studio registry's shape; src/ui never imports src/studio. */
export const specimenSections: readonly RailSection<string>[] = [
  { id: 'terrain', index: 1, code: 'TERR', title: 'Terrain' },
  { id: 'contours', index: 2, code: 'CONT', title: 'Contours' },
  { id: 'colour', index: 3, code: 'COLR', title: 'Colour' },
  { id: 'camera', index: 4, code: 'CAMR', title: 'Camera' },
  { id: 'scene', index: 5, code: 'SCEN', title: 'Scene' },
  { id: 'model', index: 6, code: 'MODL', title: 'Model' },
  { id: 'frame', index: 7, code: 'FRAM', title: 'Frame' },
];

function Demo({
  orientation = 'vertical',
  initial = 'contours',
  hiddenSectionIds,
  sections = specimenSections,
}: {
  orientation?: SectionRailOrientation;
  initial?: string;
  hiddenSectionIds?: string[];
  sections?: readonly RailSection<string>[];
}): React.JSX.Element {
  const [active, setActive] = useState(initial);

  return (
    <SectionRail
      label="Editing section"
      sections={sections}
      activeSectionId={active}
      onSelectSection={setActive}
      hiddenSectionIds={hiddenSectionIds}
      orientation={orientation}
    />
  );
}

export default defineSpecimens('section-rail', [
  { variant: 'vertical', width: 92, render: () => <Demo /> },
  { variant: 'vertical', state: 'hover', width: 92, render: () => <Demo /> },
  { variant: 'vertical', state: 'focus', width: 92, render: () => <Demo /> },
  {
    variant: 'vertical',
    state: 'gap',
    width: 92,
    render: () => <Demo hiddenSectionIds={['camera', 'model', 'frame']} />,
  },
  {
    variant: 'vertical',
    state: 'long',
    width: 92,
    render: () => (
      <Demo
        initial="long"
        sections={[
          { id: 'long', index: 12, code: 'GEOG', title: 'Geographic decorations' },
          ...specimenSections.slice(0, 2),
        ]}
      />
    ),
  },
  { variant: 'horizontal', width: 360, render: () => <Demo orientation="horizontal" /> },
  {
    variant: 'horizontal',
    state: 'focus',
    width: 360,
    render: () => <Demo orientation="horizontal" />,
  },
]);
