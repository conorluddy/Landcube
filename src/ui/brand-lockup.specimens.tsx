import { BrandLockup } from './brand-lockup';
import { defineSpecimens } from './specimens';

export default defineSpecimens('brand-lockup', [
  { variant: 'bar', render: () => <BrandLockup context="Studio" isHeading={false} /> },
  {
    variant: 'splash',
    render: () => <BrandLockup context="Studio" size="splash" isHeading={false} />,
  },
  {
    variant: 'bar',
    state: 'long',
    width: 160,
    render: () => <BrandLockup context="Studio preview environment" isHeading={false} />,
  },
  {
    variant: 'splash',
    state: 'narrow',
    width: 160,
    render: () => <BrandLockup context="Studio" size="splash" isHeading={false} />,
  },
]);
