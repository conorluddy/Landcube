import assert from 'node:assert/strict';
import test from 'node:test';
import { formatByteSize, JobList, type ExportJob } from './job-list';
import { renderMarkup } from './test-helpers';

const jobs: ExportJob[] = [
  { id: 'a', label: 'frame STL', status: 'done', fraction: 1, sizeBytes: 50_000 },
  { id: 'b', label: 'back STL', status: 'meshing', fraction: 0 },
  { id: 'c', label: 'riser STL', status: 'queued', fraction: 0 },
  { id: 'd', label: 'mount-1 STL', status: 'failed', fraction: 0, message: 'Mesh is open.' },
];

void test('JobList is a polite live ordered list with one item per job', () => {
  const markup = renderMarkup(<JobList jobs={jobs} />);

  assert.match(markup, /^<ol class="lc-job-list" aria-live="polite" aria-label="Export jobs">/);
  assert.equal(markup.match(/<li /g)?.length, 4);
});

void test('JobList shows a status tag for every status', () => {
  const markup = renderMarkup(<JobList jobs={jobs} />);

  for (const status of ['Queued', 'Meshing', 'Done', 'Failed']) {
    assert.ok(markup.includes(`>${status}</span>`), status);
  }
});

void test('JobList shows a bar only while meshing, indeterminate until progress is known', () => {
  const markup = renderMarkup(<JobList jobs={jobs} />);

  assert.equal(markup.match(/role="progressbar"/g)?.length, 1);
  assert.ok(!markup.includes('aria-valuenow'));
});

void test('JobList shows size on done jobs and the message on failed jobs', () => {
  const markup = renderMarkup(<JobList jobs={jobs} />);

  assert.ok(markup.includes('48.8 KB'));
  assert.ok(markup.includes('Mesh is open.'));
});

void test('JobList renders nothing without jobs', () => {
  assert.equal(renderMarkup(<JobList jobs={[]} />), '');
});

void test('formatByteSize picks a readable unit', () => {
  assert.equal(formatByteSize(812), '812 B');
  assert.equal(formatByteSize(2048), '2.0 KB');
  assert.equal(formatByteSize(3.5 * 1024 * 1024), '3.5 MB');
});
