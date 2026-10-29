import type { ReactNode } from 'react';
import type { StudioController, StudioState } from './controller';
import { Range } from './fields';
import { designNumberConstraints } from '../constants/design';

export interface PanelProps {
  controller: StudioController;
  state: StudioState;
}

export function DesignRange({
  controller,
  state,
  setting,
  label,
  suffix = '',
}: PanelProps & {
  setting: keyof typeof designNumberConstraints;
  label: string;
  suffix?: string;
}): ReactNode {
  const [min, max, step] = designNumberConstraints[setting];

  return (
    <Range
      id={setting}
      label={label}
      value={state.design[setting]}
      min={min}
      max={max}
      step={step}
      suffix={suffix}
      onChange={(value) => controller.design({ [setting]: value })}
    />
  );
}
