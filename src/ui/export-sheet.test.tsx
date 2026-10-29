import assert from 'node:assert/strict';
import test from 'node:test';
import { ExportSheet } from './export-sheet';
import {
  createExportSheetFixture,
  createExportSheetModelFixture,
  createExportSheetPngFixture,
} from './export-sheet.fixtures';
import { renderMarkup } from './test-helpers';

void test('ExportSheet 2D SVG state keeps every binding label and download name', () => {
  const markup = renderMarkup(<ExportSheet model={createExportSheetFixture()} />);

  for (const label of [
    'Format',
    'Size',
    'Width',
    'Height',
    'Transparent background',
    'Allow extra-large exports',
  ]) {
    assert.ok(markup.includes(`>${label}</`), label);
  }

  assert.ok(markup.includes('>Download SVG</span>'));
  assert.ok(markup.includes('alt="Settled landscape export preview"'));
  assert.ok(!markup.includes('>Resolution</'), 'Resolution is a PNG-only field');
});

void test('ExportSheet PNG state adds Resolution and names the PNG download', () => {
  const markup = renderMarkup(<ExportSheet model={createExportSheetPngFixture()} />);

  assert.ok(markup.includes('>Resolution</'));
  assert.ok(markup.includes('>Download PNG</span>'));
});

void test('ExportSheet leaves 3D sections out of the 2D view', () => {
  const markup = renderMarkup(<ExportSheet model={createExportSheetFixture()} />);

  assert.ok(!markup.includes('Download STL'));
  assert.ok(!markup.includes('3D still'));
});

void test('ExportSheet 3D state offers STL, still and per-part downloads', () => {
  const markup = renderMarkup(<ExportSheet model={createExportSheetModelFixture()} />);

  for (const name of [
    'Download STL',
    'Download 3D still',
    'Download frame STL',
    'Download back STL',
  ]) {
    assert.ok(markup.includes(`>${name}</span>`), name);
  }
});

void test('ExportSheet disables 3MF and GLB with a Soon tag and leaves STL pressed', () => {
  const markup = renderMarkup(<ExportSheet model={createExportSheetModelFixture()} />);

  assert.match(markup, /aria-pressed="true">STL<\/button>/);
  assert.match(markup, /aria-pressed="false" disabled="">3MF<span class="lc-tag"[^>]*>Soon/);
  assert.match(markup, /aria-pressed="false" disabled="">GLB<span class="lc-tag"[^>]*>Soon/);
});

void test('ExportSheet lists frame parts as checkboxes with their size', () => {
  const markup = renderMarkup(<ExportSheet model={createExportSheetModelFixture()} />);

  assert.equal(markup.match(/type="checkbox"/g)?.length, 2 + 2, 'two parts plus two switches');
  assert.ok(markup.includes('>1.5 MB</span>'));
});

void test('ExportSheet shows jobs in the live list, and attribution with its download', () => {
  const markup = renderMarkup(
    <ExportSheet
      model={createExportSheetModelFixture({
        jobs: [{ id: 'frame', label: 'frame STL', status: 'meshing', fraction: 0 }],
        attribution: {
          text: 'Contains Copernicus data.',
          action: { label: 'Download attribution', onClick: () => undefined },
        },
      })}
    />,
  );

  assert.ok(markup.includes('aria-live="polite"'));
  assert.ok(markup.includes('Contains Copernicus data.'));
  assert.ok(markup.includes('>Download attribution</span>'));
});

void test('ExportSheet announces faults with their code', () => {
  const markup = renderMarkup(
    <ExportSheet
      model={createExportSheetFixture({ faults: [{ code: 'E-401', message: 'Export failed.' }] })}
    />,
  );

  assert.match(markup, /role="alert"/);
  assert.ok(markup.includes('E-401'));
  assert.ok(markup.includes('Export failed.'));
});

void test('ExportSheet disables the primary action while busy', () => {
  const markup = renderMarkup(
    <ExportSheet
      model={createExportSheetFixture({
        primaryAction: {
          label: 'Generating…',
          onClick: () => undefined,
          isDisabled: true,
          isBusy: true,
        },
      })}
    />,
  );

  assert.match(markup, /disabled=""[^>]*aria-busy="true"|aria-busy="true"[^>]*disabled=""/);
});

void test('ExportSheet without a preview image renders an empty frame', () => {
  const base = createExportSheetFixture();
  const markup = renderMarkup(
    <ExportSheet model={{ ...base, preview: { ...base.preview, src: undefined } }} />,
  );

  assert.ok(!markup.includes('<img'));
});
