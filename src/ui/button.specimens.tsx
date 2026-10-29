import { Button, type ButtonSize, type ButtonVariant } from './button';
import { defineSpecimens, type SpecimenEntry } from './specimens';

const variants: ButtonVariant[] = ['primary', 'secondary', 'text'];
const sizes: ButtonSize[] = ['small', 'medium', 'large', 'extraLarge'];
const forcedStates = ['hover', 'focus', 'active'] as const;

const entries: SpecimenEntry[] = variants.flatMap((variant) => [
  ...sizes.map((size) => ({
    variant,
    size,
    render: () => (
      <Button variant={variant} size={size} trailingGlyph="→">
        Export
      </Button>
    ),
  })),
  ...forcedStates.map((state) => ({
    variant,
    state,
    render: () => <Button variant={variant}>Export</Button>,
  })),
  {
    variant,
    state: 'disabled',
    render: () => (
      <Button variant={variant} disabled>
        Export
      </Button>
    ),
  },
  {
    variant,
    state: 'busy',
    render: () => (
      <Button variant={variant} isBusy>
        Exporting
      </Button>
    ),
  },
  {
    variant,
    state: 'long',
    width: 160,
    render: () => <Button variant={variant}>Copy style link to clipboard</Button>,
  },
  {
    variant,
    state: 'fullWidth',
    width: 160,
    render: () => (
      <Button variant={variant} isFullWidth>
        Full width
      </Button>
    ),
  },
]);

export default defineSpecimens('button', entries);
