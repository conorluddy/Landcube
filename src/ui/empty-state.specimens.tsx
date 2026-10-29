import { EmptyState } from './empty-state';
import { defineSpecimens } from './specimens';

export default defineSpecimens('empty-state', [
  {
    variant: 'default',
    render: () => (
      <EmptyState glyph="◇" title="No terrain loaded">
        Choose a place or enter coordinates, then load terrain.
      </EmptyState>
    ),
  },
  {
    variant: 'action',
    render: () => (
      <EmptyState
        glyph="▦"
        title="Library empty"
        action={{ label: 'New design', onClick: () => undefined }}
      >
        Saved designs appear here.
      </EmptyState>
    ),
  },
  {
    variant: 'titleOnly',
    width: 200,
    render: () => <EmptyState title="Nothing here yet" />,
  },
]);
