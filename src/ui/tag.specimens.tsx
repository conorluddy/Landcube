import { defineSpecimens } from './specimens';
import { Tag } from './tag';

export default defineSpecimens('tag', [
  { variant: 'outlineBone', render: () => <Tag variant="outlineBone">Printed</Tag> },
  { variant: 'outlineMuted', render: () => <Tag variant="outlineMuted">Draft</Tag> },
  { variant: 'solidBone', render: () => <Tag variant="solidBone">A</Tag> },
  { variant: 'fileType', render: () => <Tag variant="fileType">Svg</Tag> },
  {
    variant: 'outlineBone',
    state: 'long',
    width: 120,
    render: () => <Tag variant="outlineBone">Exported to a very long destination</Tag>,
  },
]);
