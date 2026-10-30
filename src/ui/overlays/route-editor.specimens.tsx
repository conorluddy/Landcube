import { defineSpecimens } from '../specimens';
import { RouteEditor } from './route-editor';
import { SpecimenStage } from './specimen-stage';

const noop = () => undefined;
const points = [
  { xPx: 24, yPx: 128 },
  { xPx: 96, yPx: 88 },
  { xPx: 168, yPx: 104 },
  { xPx: 232, yPx: 40 },
];

function renderEditor(tone: 'light' | 'dark', selectedIndex?: number) {
  return (
    <SpecimenStage tone={tone} heightPx={160}>
      <RouteEditor
        points={points}
        selectedIndex={selectedIndex}
        isPlacing={false}
        onSurfacePointer={noop}
        onSelect={noop}
        onMove={noop}
        onInsert={noop}
      />
    </SpecimenStage>
  );
}

export default defineSpecimens('route-editor', [
  { variant: 'handles', size: 'onDark', width: 256, render: () => renderEditor('dark') },
  { variant: 'handles', size: 'onLight', width: 256, render: () => renderEditor('light') },
  { variant: 'selected', width: 256, render: () => renderEditor('dark', 2) },
]);
