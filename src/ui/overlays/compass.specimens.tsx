import { defineSpecimens } from '../specimens';
import { Compass } from './compass';

export default defineSpecimens('compass', [
  { variant: 'north', render: () => <Compass headingDegrees={0} /> },
  { variant: 'heading312', render: () => <Compass headingDegrees={312} /> },
  { variant: 'heading90', render: () => <Compass headingDegrees={90} /> },
]);
