import type { ReactNode } from 'react';

export interface FieldPairProps {
  children: [ReactNode, ReactNode];
}

/** Two fields side by side (P-09); stacks when its container is narrower than 300px. */
export function FieldPair({ children }: FieldPairProps): React.JSX.Element {
  return (
    <div className="lc-field-pair">
      <div className="lc-field-pair__grid">
        {children[0]}
        {children[1]}
      </div>
    </div>
  );
}
