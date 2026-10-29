import { useState } from 'react';
import { Segmented, type SegmentedSize } from './segmented';
import { defineSpecimens, type SpecimenEntry } from './specimens';

const allOptions = [
  { value: 'one', label: 'Contour', description: 'Contour lines only' },
  { value: 'two', label: 'Relief' },
  { value: 'three', label: 'Both' },
  { value: 'four', label: 'None' },
];
const longOptions = [
  { value: 'one', label: 'Extraordinarily long label' },
  { value: 'two', label: 'Another lengthy choice' },
  { value: 'three', label: 'Short' },
];
const sizes: SegmentedSize[] = ['compact', 'medium', 'bar', 'large'];
const optionCounts = [
  { variant: 'two-options', count: 2 },
  { variant: 'three-options', count: 3 },
  { variant: 'four-options', count: 4 },
];

interface DemoProps {
  count?: number;
  size?: SegmentedSize;
  disabled?: boolean;
  isLabelVisible?: boolean;
  isOnGlassBar?: boolean;
  isLong?: boolean;
}

function SegmentedDemo({ count = 3, isLong = false, ...props }: DemoProps): React.JSX.Element {
  const options = isLong ? longOptions : allOptions.slice(0, count);
  const [value, setValue] = useState(options[0]?.value ?? 'one');

  return (
    <Segmented label="Display" value={value} options={options} onChange={setValue} {...props} />
  );
}

const sizeEntries: SpecimenEntry[] = optionCounts.flatMap(({ variant, count }) =>
  sizes.map((size) => ({
    variant,
    size,
    render: () => <SegmentedDemo count={count} size={size} />,
  })),
);

export default defineSpecimens('segmented', [
  ...sizeEntries,
  { variant: 'three-options', size: 'medium', state: 'hover', render: () => <SegmentedDemo /> },
  { variant: 'three-options', size: 'medium', state: 'focus', render: () => <SegmentedDemo /> },
  { variant: 'three-options', size: 'medium', state: 'active', render: () => <SegmentedDemo /> },
  {
    variant: 'three-options',
    size: 'medium',
    state: 'disabled',
    render: () => <SegmentedDemo disabled />,
  },
  {
    variant: 'long-labels',
    size: 'medium',
    width: 200,
    render: () => <SegmentedDemo isLong />,
  },
  {
    variant: 'hidden-label',
    size: 'bar',
    render: () => <SegmentedDemo count={2} size="bar" isLabelVisible={false} />,
  },
  {
    variant: 'on-glass-bar',
    size: 'bar',
    render: () => (
      <div style={{ padding: 'var(--lc-s-6)', background: 'var(--lc-canvas)' }}>
        <SegmentedDemo count={2} size="bar" isLabelVisible={false} isOnGlassBar />
      </div>
    ),
  },
]);
