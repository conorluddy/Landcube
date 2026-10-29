import type { ReactNode } from 'react';
import { BarGroup, FloatingBar } from '../ui/floating-bar';
import { BrandLockup } from '../ui/brand-lockup';
import { Button } from '../ui/button';
import { Segmented } from '../ui/segmented';
import type { StudioController, StudioState, StudioView } from './controller';
import { PlaceSearchField } from './place-search-field';

type TerrainSource = StudioState['source']['selected'];

const viewOptions = [
  { value: '2d', label: '2D' },
  { value: '3d', label: '3D' },
] as const satisfies readonly { value: StudioView; label: string }[];

const sourceOptions = [
  { value: 'generated', label: 'Procedural' },
  { value: 'real', label: 'Coordinates' },
] as const satisfies readonly { value: TerrainSource; label: string }[];

/**
 * Top bar of glass pills: brand, view and terrain-source switches, place search, then the
 * style-link and export actions. The search shrinks first and hides below a measured width
 * (see `.studio-shell` container rules in landscape-studio.css).
 */
export function StudioHeader({
  controller: c,
  state,
  isPhoneViewport,
}: {
  controller: StudioController;
  state: StudioState;
  /** Phones fit one row: Export moves to the sheet's peek row and the link action shortens. */
  isPhoneViewport: boolean;
}): ReactNode {
  const isRealSource = state.source.selected === 'real';

  return (
    <FloatingBar as="header" className="studio-header">
      <BarGroup className="studio-brand">
        <BrandLockup context="Studio" />
      </BarGroup>
      <Segmented
        label="View"
        isLabelVisible={false}
        size="bar"
        isOnGlassBar
        value={state.workspace.view}
        options={viewOptions}
        disabled={state.workspace.activating}
        onChange={(view) => {
          void c.selectView(view);
        }}
      />
      <Segmented
        label="Terrain source"
        isLabelVisible={false}
        size="bar"
        isOnGlassBar
        value={state.source.selected}
        options={sourceOptions}
        onChange={(source) => {
          if (source === 'generated') {
            c.useGenerated();
          } else {
            void c.useCoordinates();
          }
        }}
      />
      <div className="header-place-search" data-open={isRealSource} inert={!isRealSource}>
        <PlaceSearchField controller={c} />
      </div>
      <BarGroup isSpacer />
      <BarGroup className="studio-actions">
        <Button
          variant="text"
          size="small"
          title="Copies shared design settings. Location and 3D setup are excluded."
          aria-label={isPhoneViewport ? 'Copy style link' : undefined}
          onClick={() => {
            void c.copyLink();
          }}
        >
          {isPhoneViewport ? 'Link' : 'Copy style link'}
        </Button>
        {!isPhoneViewport && (
          <Button
            variant="primary"
            size="small"
            aria-haspopup="dialog"
            onClick={() => {
              c.workspace({ exporting: true, popover: null });
            }}
          >
            Export ↗
          </Button>
        )}
      </BarGroup>
    </FloatingBar>
  );
}
