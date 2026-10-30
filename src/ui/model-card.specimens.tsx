import { defineSpecimens } from './specimens';
import { ModelCard } from './model-card';
import { Tag } from './tag';

const thumbnail = <span aria-hidden="true">≋</span>;

export default defineSpecimens('model-card', [
  {
    variant: 'default',
    width: 172,
    render: () => (
      <ModelCard
        title="Ridge"
        subtitle="Seed 12 · 3 min ago"
        thumbnail={thumbnail}
        tags={<Tag variant="outlineBone">Real</Tag>}
        onOpen={() => undefined}
      />
    ),
  },
  {
    variant: 'deletable',
    width: 172,
    render: () => (
      <ModelCard
        title="Fjord"
        subtitle="Seed 99"
        thumbnail={thumbnail}
        onOpen={() => undefined}
        onDelete={() => undefined}
      />
    ),
  },
  {
    variant: 'default',
    state: 'long',
    width: 140,
    render: () => (
      <ModelCard
        title="A very long saved design name"
        subtitle="Procedural landscape saved on a long date"
        thumbnail={thumbnail}
        tags={<Tag variant="outlineMuted">Procedural</Tag>}
        onOpen={() => undefined}
      />
    ),
  },
]);
