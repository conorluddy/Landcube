import { FaultCard } from './fault-card';
import { defineSpecimens } from './specimens';

const noop = (): void => undefined;
const retry = { label: 'Retry', onClick: noop };
const secondaries = [
  { label: 'Dismiss', onClick: noop },
  { label: 'Procedural', onClick: noop },
];

export default defineSpecimens('fault-card', [
  {
    variant: 'floating',
    render: () => (
      <FaultCard
        code="E-201"
        title="Tile download failed"
        metric="3 of 9 tiles"
        primaryAction={retry}
        secondaryActions={secondaries}
      >
        Terrain tile download failed (HTTP 503). Check your connection and retry.
      </FaultCard>
    ),
  },
  {
    variant: 'inline',
    render: () => (
      <FaultCard code="E-202" title="Map data unavailable" isInline primaryAction={retry}>
        The roads service is busy. Retry in a moment.
      </FaultCard>
    ),
  },
  {
    variant: 'floating',
    state: 'narrow',
    width: 240,
    render: () => (
      <FaultCard
        code="E-204"
        title="Tile decode failed with a very long title"
        metric="44% void"
        primaryAction={retry}
        secondaryActions={secondaries}
      >
        A tile came back that could not be decoded.
      </FaultCard>
    ),
  },
]);
