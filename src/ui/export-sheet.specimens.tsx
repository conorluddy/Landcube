import { ExportSheet } from './export-sheet';
import {
  createExportModelSectionFixture,
  createExportSheetFixture,
  createExportSheetModelFixture,
  createExportSheetPngFixture,
} from './export-sheet.fixtures';
import { defineSpecimens } from './specimens';
import { SuccessSheet } from './success-sheet';

const noop = (): void => undefined;
const dialogWidth = 440;
const mobileWidth = 390;
const narrowWidth = 320;

export default defineSpecimens('export-sheet', [
  {
    variant: 'svg',
    width: dialogWidth,
    render: () => <ExportSheet model={createExportSheetFixture()} />,
  },
  {
    variant: 'png',
    width: dialogWidth,
    render: () => <ExportSheet model={createExportSheetPngFixture()} />,
  },
  {
    variant: 'stl',
    width: dialogWidth,
    render: () => (
      <ExportSheet
        model={createExportSheetModelFixture({
          model: {
            ...createExportModelSectionFixture(),
            parts: undefined,
            partHints: undefined,
            partsAction: undefined,
          },
        })}
      />
    ),
  },
  {
    variant: 'stl',
    state: 'parts',
    width: dialogWidth,
    render: () => <ExportSheet model={createExportSheetModelFixture()} />,
  },
  {
    variant: 'stl',
    state: 'jobsRunning',
    width: dialogWidth,
    render: () => (
      <ExportSheet
        model={createExportSheetModelFixture({
          jobs: [
            { id: 'frame', label: 'frame STL', status: 'done', fraction: 1, sizeBytes: 1_480_000 },
            { id: 'back', label: 'back STL', status: 'meshing', fraction: 0 },
            { id: 'riser', label: 'riser STL', status: 'queued', fraction: 0 },
          ],
        })}
      />
    ),
  },
  {
    variant: 'stl',
    state: 'jobsDone',
    width: dialogWidth,
    render: () => (
      <ExportSheet
        model={createExportSheetModelFixture({
          jobs: [
            { id: 'frame', label: 'frame STL', status: 'done', fraction: 1, sizeBytes: 1_480_000 },
            { id: 'back', label: 'back STL', status: 'done', fraction: 1, sizeBytes: 212_000 },
          ],
          success: (
            <SuccessSheet
              title="2 frame parts downloaded"
              rows={[
                { glyph: '▤', label: 'Files', onClick: noop },
                {
                  glyph: '⎙',
                  label: 'Send to printer',
                  onClick: noop,
                  isDisabled: true,
                  tag: 'Soon',
                },
                { glyph: '⧉', label: 'Copy style link', onClick: noop },
              ]}
              onDone={noop}
            />
          ),
        })}
      />
    ),
  },
  {
    variant: 'stl',
    state: 'jobFailed',
    width: dialogWidth,
    render: () => (
      <ExportSheet
        model={createExportSheetModelFixture({
          jobs: [
            { id: 'frame', label: 'frame STL', status: 'done', fraction: 1, sizeBytes: 1_480_000 },
            {
              id: 'back',
              label: 'back STL',
              status: 'failed',
              fraction: 0,
              message: 'The back part is not watertight. Adjust the frame and retry.',
            },
          ],
        })}
      />
    ),
  },
  {
    variant: 'fault',
    width: dialogWidth,
    render: () => (
      <ExportSheet
        model={createExportSheetFixture({
          faults: [
            {
              code: 'E-401',
              message:
                'PNG dimensions must be at most 4096 px per side. Choose 1× or reduce the output size.',
            },
          ],
          primaryAction: { label: 'Download PNG', onClick: noop, isDisabled: true },
        })}
      />
    ),
  },
  {
    variant: 'realTerrain',
    width: dialogWidth,
    render: () => (
      <ExportSheet
        model={createExportSheetModelFixture({
          target: 'Real terrain · Mount Brandon',
          attribution: {
            text: 'Contains Copernicus data. Elevation tiles from Mapzen via AWS Open Data.',
            action: { label: 'Download attribution', onClick: noop },
          },
        })}
      />
    ),
  },
  {
    variant: 'plaque',
    width: dialogWidth,
    render: () => (
      <ExportSheet
        model={createExportSheetModelFixture({
          model: {
            ...createExportModelSectionFixture(),
            plaqueText: { value: '', onChange: noop },
          },
        })}
      />
    ),
  },
  {
    variant: 'stl',
    state: 'mobile',
    width: mobileWidth,
    render: () => <ExportSheet model={createExportSheetModelFixture()} />,
  },
  {
    variant: 'stl',
    state: 'narrow',
    width: narrowWidth,
    render: () => <ExportSheet model={createExportSheetModelFixture()} />,
  },
]);
