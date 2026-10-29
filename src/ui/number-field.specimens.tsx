import { useEffect, useRef, useState } from 'react';
import { NumberField } from './number-field';
import { defineSpecimens } from './specimens';

function Demo({
  initial,
  label = 'Width',
  ...rest
}: {
  initial: number | undefined;
  label?: string;
  unit?: string;
  disabled?: boolean;
  isOptional?: boolean;
  min?: number;
  max?: number;
  isBlurredOnMount?: boolean;
}): React.JSX.Element {
  const { isBlurredOnMount = false, ...fieldProps } = rest;
  const [value, setValue] = useState(initial);
  const wrapper = useRef<HTMLDivElement>(null);

  // Focus then blur commits the out-of-range draft, which raises the alert.
  useEffect(() => {
    if (isBlurredOnMount) {
      const input = wrapper.current?.querySelector('input');

      input?.focus();
      input?.blur();
    }
  }, [isBlurredOnMount]);

  return (
    <div ref={wrapper}>
      <NumberField label={label} value={value} onChange={setValue} {...fieldProps} />
    </div>
  );
}

export default defineSpecimens('number-field', [
  { variant: 'default', render: () => <Demo initial={1200} unit="px" min={320} max={8192} /> },
  { variant: 'default', state: 'hover', render: () => <Demo initial={1200} unit="px" /> },
  { variant: 'default', state: 'focus', render: () => <Demo initial={1200} unit="px" /> },
  { variant: 'default', state: 'active', render: () => <Demo initial={1200} unit="px" /> },
  { variant: 'default', state: 'disabled', render: () => <Demo initial={1200} disabled /> },
  { variant: 'empty', render: () => <Demo initial={undefined} isOptional unit="m" /> },
  {
    variant: 'invalid',
    render: () => (
      <Demo initial={99999} unit="px" min={320} max={8192} label="Width" isBlurredOnMount />
    ),
  },
  {
    variant: 'default',
    state: 'long',
    render: () => (
      <Demo initial={5} unit="m" label="Contour interval between neighbouring elevation lines" />
    ),
  },
  { variant: 'default', state: 'narrow', width: 200, render: () => <Demo initial={5} unit="px" /> },
]);
