import { ModelDossier } from './model-dossier';
import {
  createModelDossierFixture,
  createProceduralDossierFixture,
  createRealDossierFixture,
} from './model-dossier.fixtures';
import { defineSpecimens } from './specimens';

const noop = (): void => undefined;
const sheetWidth = 560;
// Whole-pixel slot: the sheet's text heights are fractional, which would shift the specimens below it.
const sheetSlot = { height: 1100, overflow: 'hidden' } as const;

export default defineSpecimens('model-dossier', [
  {
    variant: 'procedural',
    width: sheetWidth,
    render: () => (
      <div style={sheetSlot}>
        <ModelDossier model={createProceduralDossierFixture()} onPrint={noop} onCopyLink={noop} />
      </div>
    ),
  },
  {
    variant: 'real',
    width: sheetWidth,
    render: () => (
      <div style={sheetSlot}>
        <ModelDossier model={createRealDossierFixture()} onPrint={noop} onCopyLink={noop} />
      </div>
    ),
  },
  {
    variant: '3d-frame',
    width: sheetWidth,
    render: () => (
      <div style={sheetSlot}>
        <ModelDossier model={createModelDossierFixture()} onPrint={noop} onCopyLink={noop} />
      </div>
    ),
  },
]);
