import type { ReactNode } from 'react';
import { PartRow } from './part-row';
import { defineSpecimens } from './specimens';

const select = (): void => undefined;

/** The row bleeds 18px either side, as it does inside the inspector body's padding. */
function Body({ children }: { children: ReactNode }): React.JSX.Element {
  return <div style={{ padding: '0 18px' }}>{children}</div>;
}

export default defineSpecimens('part-row', [
  {
    variant: 'default',
    width: 300,
    render: () => (
      <Body>
        <PartRow code="PRIM.04" name="Ruler slider" count="03" isActive={false} onSelect={select} />
      </Body>
    ),
  },
  {
    variant: 'default',
    state: 'hover',
    width: 300,
    render: () => (
      <Body>
        <PartRow code="PRIM.04" name="Ruler slider" count="03" isActive={false} onSelect={select} />
      </Body>
    ),
  },
  {
    variant: 'active',
    width: 300,
    render: () => (
      <Body>
        <PartRow code="PRIM.04" name="Ruler slider" count="03" isActive onSelect={select} />
      </Body>
    ),
  },
  {
    variant: 'default',
    state: 'long',
    width: 300,
    render: () => (
      <Body>
        <PartRow
          code="COMP.12"
          name="Detachable control group with a very long name"
          count="11"
          isActive={false}
          onSelect={select}
        />
      </Body>
    ),
  },
]);
