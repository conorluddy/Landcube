import { GlassPanel } from './glass-panel';
import { StatusMessage } from './status-message';
import { defineSpecimens } from './specimens';

export default defineSpecimens('glass-panel', [
  {
    variant: 'default',
    width: 320,
    render: () => (
      <GlassPanel label="Overlays">
        <StatusMessage kind="info">Grid, summits and north arrow.</StatusMessage>
      </GlassPanel>
    ),
  },
  {
    variant: 'flush',
    width: 320,
    render: () => (
      <GlassPanel padding="none">
        <StatusMessage kind="ok">Content lays out its own edges.</StatusMessage>
      </GlassPanel>
    ),
  },
  {
    variant: 'default',
    state: 'motion',
    width: 320,
    render: () => (
      <div data-motion="active">
        <GlassPanel>
          <StatusMessage kind="info">Opaque while the camera moves.</StatusMessage>
        </GlassPanel>
      </div>
    ),
  },
]);
