import { IconButton } from './icon-button';
import { defineSpecimens } from './specimens';

const noop = (): void => undefined;

export default defineSpecimens('icon-button', [
  { variant: 'default', render: () => <IconButton glyph="⌖" label="Locate me" onClick={noop} /> },
  {
    variant: 'active',
    render: () => <IconButton glyph="◧" label="Layers" isActive onClick={noop} />,
  },
  {
    variant: 'default',
    state: 'hover',
    render: () => <IconButton glyph="⌖" label="Locate me" onClick={noop} />,
  },
  {
    variant: 'default',
    state: 'focus',
    render: () => <IconButton glyph="⌖" label="Locate me" onClick={noop} />,
  },
  {
    variant: 'default',
    state: 'active',
    render: () => <IconButton glyph="⌖" label="Locate me" onClick={noop} />,
  },
  {
    variant: 'default',
    state: 'disabled',
    render: () => <IconButton glyph="⌖" label="Locate me" disabled onClick={noop} />,
  },
]);
