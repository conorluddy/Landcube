import { LoaderCard } from './loader-card';
import { defineSpecimens } from './specimens';

const cancel = (): void => undefined;

export default defineSpecimens('loader-card', [
  {
    variant: 'determinate',
    render: () => (
      <LoaderCard title="Loading terrain" fraction={0.44} detail="4 of 9 tiles" onCancel={cancel} />
    ),
  },
  {
    variant: 'indeterminate',
    render: () => <LoaderCard title="Loading terrain" fraction={NaN} onCancel={cancel} />,
  },
  {
    variant: 'complete',
    render: () => <LoaderCard title="Loading terrain" fraction={1} detail="9 of 9 tiles" />,
  },
  {
    variant: 'determinate',
    state: 'narrow',
    width: 200,
    render: () => (
      <LoaderCard
        title="Downloading a very long place name"
        fraction={0.2}
        detail="2 of 9 tiles"
        onCancel={cancel}
      />
    ),
  },
]);
