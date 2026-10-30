import { GroupHeader } from './group-header';
import { defineSpecimens } from './specimens';

export default defineSpecimens('group-header', [
  { variant: 'titleOnly', render: () => <GroupHeader title="Contours" /> },
  { variant: 'withCode', render: () => <GroupHeader title="Contours" code="CONT.03" /> },
  {
    variant: 'withTrailing',
    render: () => <GroupHeader title="Contours" code="CONT.03" trailing="Reset" />,
  },
  {
    variant: 'withCode',
    state: 'narrow',
    width: 160,
    render: () => <GroupHeader title="Contours" code="CONT.03" trailing="Reset" />,
  },
  {
    variant: 'withCode',
    state: 'long',
    width: 160,
    render: () => (
      <GroupHeader title="Elevation contour interval settings" code="CONT.03" trailing="Reset" />
    ),
  },
]);
