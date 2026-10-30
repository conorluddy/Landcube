import { defineSpecimens } from './specimens';
import { ListRow } from './list-row';

export default defineSpecimens('list-row', [
  {
    variant: 'button',
    width: 358,
    render: () => (
      <ListRow
        title="Clear local data"
        detail="Saved designs and settings"
        leading="○"
        onClick={() => undefined}
      />
    ),
  },
  {
    variant: 'link',
    width: 358,
    render: () => (
      <ListRow
        title="OpenStreetMap roads"
        detail="Contributors"
        meta="ODbL"
        href="https://www.openstreetmap.org/copyright"
      />
    ),
  },
  { variant: 'static', width: 358, render: () => <ListRow title="Version" meta="0.2.0" /> },
  {
    variant: 'static',
    state: 'empty',
    width: 358,
    render: () => <ListRow title="Units" meta="" />,
  },
  {
    variant: 'button',
    state: 'long',
    width: 240,
    render: () => (
      <ListRow
        title="A very long row title that must be truncated with an ellipsis"
        detail="An equally long detail line that must not wrap either"
        meta="Value"
        leading="◧"
        onClick={() => undefined}
      />
    ),
  },
]);
