import { useState } from 'react';
import { BottomSheet } from './bottom-sheet';
import { Button } from './button';
import { ReadoutCell, ReadoutGrid } from './readout-grid';
import { SectionRail } from './section-rail';
import { specimenSections } from './section-rail.specimens';
import type { SheetSnap } from './sheet-handle';
import { defineSpecimens } from './specimens';
import { StatusMessage } from './status-message';

/** A 390-wide phone screen cut to 400px tall; the sheet resolves its snaps against it. */
function Demo({ initialSnap }: { initialSnap: SheetSnap }): React.JSX.Element {
  const [snap, setSnap] = useState<SheetSnap>(initialSnap);
  const [active, setActive] = useState('terrain');

  return (
    <div style={{ position: 'relative', height: 400, overflow: 'hidden' }}>
      <BottomSheet
        id={`specimen-sheet-${initialSnap}`}
        label="Landscape controls"
        snap={snap}
        onSnapChange={setSnap}
        peek={
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <ReadoutGrid>
                <ReadoutCell label="High" value="751" unit="m" />
                <ReadoutCell label="Span" value="5.09" unit="km" />
              </ReadoutGrid>
            </div>
            <Button variant="primary" size="small">
              Export ↗
            </Button>
          </div>
        }
        header={
          <SectionRail
            label="Editing section"
            sections={specimenSections}
            activeSectionId={active}
            onSelectSection={setActive}
            orientation="horizontal"
          />
        }
      >
        {Array.from({ length: 8 }, (_, index) => (
          <StatusMessage key={index} kind="ok" code={`ROW.${String(index + 1)}`}>
            Section body row {index + 1}.
          </StatusMessage>
        ))}
      </BottomSheet>
    </div>
  );
}

export default defineSpecimens('bottom-sheet', [
  { variant: 'peek', width: 390, render: () => <Demo initialSnap="peek" /> },
  { variant: 'half', width: 390, render: () => <Demo initialSnap="half" /> },
  { variant: 'full', width: 390, render: () => <Demo initialSnap="full" /> },
  { variant: 'half', state: 'narrow', width: 320, render: () => <Demo initialSnap="half" /> },
]);
