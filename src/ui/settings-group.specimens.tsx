import { defineSpecimens } from './specimens';
import { ListRow } from './list-row';
import { SettingsGroup } from './settings-group';

export default defineSpecimens('settings-group', [
  {
    variant: 'default',
    width: 358,
    render: () => (
      <SettingsGroup title="Data sources" code="SET.03">
        <ListRow title="Terrarium elevation" detail="Mapzen · AWS" />
        <ListRow title="OpenStreetMap roads" detail="Contributors" meta="ODbL" />
      </SettingsGroup>
    ),
  },
  {
    variant: 'default',
    state: 'narrow',
    width: 240,
    render: () => (
      <SettingsGroup title="A very long settings group title for narrow screens">
        <ListRow title="Row" meta="Value" />
      </SettingsGroup>
    ),
  },
]);
