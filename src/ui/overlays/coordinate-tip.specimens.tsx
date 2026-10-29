import { defineSpecimens } from '../specimens';
import { CoordinateTip } from './coordinate-tip';

export default defineSpecimens('coordinate-tip', [
  { variant: 'geographic', render: () => <CoordinateTip lines={['55.0343°N', '8.1130°W']} /> },
  { variant: 'local', render: () => <CoordinateTip lines={['E 12,480 m', 'S 3,005 m']} /> },
  { variant: 'geographic', state: 'empty', render: () => <CoordinateTip lines={[]} /> },
]);
