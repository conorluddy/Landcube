import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkup } from '../test-helpers';
import { ReadoutCard, type ReadoutCardProps } from './readout-card';

const props: ReadoutCardProps = {
  title: 'Errigal',
  place: 'Ireland',
  sourceLabel: 'EU-DEM',
  signalKind: 'ok',
  cells: [
    { label: 'Lat', value: '55.0343°N' },
    { label: 'Span', value: '8 × 8', unit: 'km' },
  ],
};

void test('ReadoutCard is a Target lock region marked as a glass UI surface', () => {
  const markup = renderMarkup(<ReadoutCard {...props} />);

  assert.match(
    markup,
    /^<section class="lc-readout-card lc-glass" aria-label="Target lock" data-ui-surface="true">/,
  );
});

void test('ReadoutCard shows the title, place, source label and one readout cell per entry', () => {
  const markup = renderMarkup(<ReadoutCard {...props} />);

  assert.ok(markup.includes('>Errigal</p>'));
  assert.ok(markup.includes('>Ireland</p>'));
  assert.ok(markup.includes('title="EU-DEM">EU-DEM</span>'));
  assert.equal(markup.match(/class="lc-readout-cell"/g)?.length, 2);
});

void test('a hidden ReadoutCard uses the hidden attribute so the landmark disappears', () => {
  assert.match(renderMarkup(<ReadoutCard {...props} isHidden />), /^<section[^>]* hidden="">/);
});

void test('ReadoutCard adds a scale bar and the data credit only when given', () => {
  const bare = renderMarkup(<ReadoutCard {...props} />);
  const full = renderMarkup(
    <ReadoutCard
      {...props}
      scaleBar={{ totalKm: 2, lengthPx: 248 }}
      attribution="Produced using Copernicus data"
    />,
  );

  assert.ok(!bare.includes('lc-scale-bar') && !bare.includes('lc-readout-card__attribution'));
  assert.ok(full.includes('aria-label="Scale bar, 2 km"'));
  assert.ok(full.includes('>Produced using Copernicus data</p>'));
});

void test('ReadoutCard accepts a custom label for its region and header', () => {
  const markup = renderMarkup(<ReadoutCard {...props} label="Waypoint" />);

  assert.ok(markup.includes('aria-label="Waypoint"'));
  assert.ok(markup.includes('</span>Waypoint</span>'));
});
