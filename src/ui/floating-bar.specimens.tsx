import { BrandLockup } from './brand-lockup';
import { Button } from './button';
import { BarGroup, FloatingBar, type FloatingBarSize } from './floating-bar';
import { SearchField, searchFieldInputClassName } from './search-field';
import { Segmented } from './segmented';
import { SignalMark } from './signal-mark';
import { defineSpecimens } from './specimens';

const viewOptions = [
  { value: '2d', label: '2D' },
  { value: '3d', label: '3D' },
];

function TopBar({ size = 'bar' }: { size?: FloatingBarSize }): React.JSX.Element {
  return (
    <FloatingBar size={size}>
      <BarGroup>
        <BrandLockup context="Studio" isHeading={false} />
      </BarGroup>
      <Segmented
        label="View"
        isLabelVisible={false}
        size="bar"
        isOnGlassBar
        value="3d"
        options={viewOptions}
        onChange={() => undefined}
      />
      <SearchField
        label="Search"
        isOpen={false}
        input={
          <input
            className={searchFieldInputClassName}
            type="text"
            role="combobox"
            aria-expanded={false}
            placeholder="Mountain, town, lake…"
          />
        }
        popover={null}
      />
      <BarGroup isSpacer />
      <BarGroup>
        <Button variant="text" size="small">
          Copy style link
        </Button>
        <Button variant="primary" size="small">
          Export ↗
        </Button>
      </BarGroup>
    </FloatingBar>
  );
}

function StatusBar(): React.JSX.Element {
  return (
    <FloatingBar size="footer">
      <BarGroup role="group" label="Viewport tools">
        <Button variant="text" size="small" aria-expanded>
          Controls ↓
        </Button>
        <Button variant="text" size="small">
          Overlays
        </Button>
        <Button variant="text" size="small" aria-pressed>
          ❚❚ Tour
        </Button>
      </BarGroup>
      <BarGroup>
        <SignalMark kind="ok" size="footer" />
        <Button variant="text" size="small">
          GitHub ↗
        </Button>
      </BarGroup>
    </FloatingBar>
  );
}

export default defineSpecimens('floating-bar', [
  { variant: 'bar', width: 760, render: () => <TopBar /> },
  { variant: 'bar', state: 'narrow', width: 560, render: () => <TopBar /> },
  { variant: 'mobile', width: 760, render: () => <TopBar size="mobile" /> },
  { variant: 'footer', width: 520, render: () => <StatusBar /> },
]);
