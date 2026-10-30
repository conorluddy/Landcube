import { defineSpecimens } from './specimens';
import { TabBar } from './tab-bar';

const items = [
  { id: 'library', glyph: '▦', label: 'Library' },
  { id: 'studio', glyph: '≋', label: 'Studio' },
  { id: 'presets', glyph: '◧', label: 'Presets' },
  { id: 'account', glyph: '○', label: 'Account' },
];

export default defineSpecimens('tab-bar', [
  {
    variant: 'default',
    width: 390,
    render: () => <TabBar items={items} activeId="studio" onSelect={() => undefined} />,
  },
  {
    variant: 'library',
    state: 'narrow',
    width: 320,
    render: () => <TabBar items={items} activeId="library" onSelect={() => undefined} />,
  },
]);
