import { defineSpecimens } from './specimens';
import { PresetCard, PresetStrip } from './preset-card';

export default defineSpecimens('preset-card', [
  {
    variant: 'strip',
    width: 390,
    render: () => (
      <PresetStrip label="Palettes">
        <PresetCard
          name="Charcoal"
          swatches={['#1a1b1d', '#c9cbcd']}
          isActive
          onSelect={() => undefined}
        />
        <PresetCard name="Paper" swatches={['#eee9dd', '#716c5e']} onSelect={() => undefined} />
        <PresetCard name="Blueprint" swatches={['#153c68', '#b9dbf5']} onSelect={() => undefined} />
        <PresetCard name="Bold" swatches={['#151816', '#c2dc8a']} onSelect={() => undefined} />
      </PresetStrip>
    ),
  },
  {
    variant: 'card',
    state: 'long',
    width: 140,
    render: () => (
      <PresetCard
        name="A very long preset name"
        swatches={['#000', '#fff', '#888']}
        onSelect={() => undefined}
      />
    ),
  },
]);
