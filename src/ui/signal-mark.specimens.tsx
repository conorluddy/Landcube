import {
  SignalMark,
  type SignalMarkAccent,
  type SignalMarkKind,
  type SignalMarkSize,
} from './signal-mark';
import { defineSpecimens, type SpecimenEntry } from './specimens';

const kinds: SignalMarkKind[] = ['ok', 'live', 'fault', 'waypoint'];
const sizes: SignalMarkSize[] = ['footer', 'default', 'large'];
const accents: SignalMarkAccent[] = ['bone', 'amber', 'phosphor'];

const entries: SpecimenEntry[] = kinds.flatMap((kind) => [
  ...sizes.map((size) => ({
    variant: kind,
    size,
    render: () => <SignalMark kind={kind} size={size} label={`${kind} status`} />,
  })),
  ...accents
    .filter((accent) => accent !== 'bone')
    .map((accent) => ({
      variant: kind,
      state: accent,
      render: () => <SignalMark kind={kind} accent={accent} />,
    })),
]);

export default defineSpecimens('signal-mark', entries);
