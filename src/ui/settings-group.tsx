import type { ReactNode } from 'react';
import { GroupHeader } from './group-header';

export interface SettingsGroupProps {
  title: string;
  /** Decorative group code such as 'SET.01'. */
  code?: string;
  /** `ListRow`s, `Segmented` rows or other row-shaped controls. */
  children: ReactNode;
}

/** Titled group of settings rows (C-21): a `GroupHeader` over a hairline list. */
export function SettingsGroup({ title, code, children }: SettingsGroupProps): React.JSX.Element {
  return (
    <section className="lc-settings-group" aria-label={title}>
      <GroupHeader title={title} code={code} />
      <div className="lc-settings-group__rows">{children}</div>
    </section>
  );
}
