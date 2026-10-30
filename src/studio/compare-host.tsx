import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Button } from '../ui/button';
import { Wipe } from '../ui/overlays/wipe';
import { PresetCard, PresetStrip } from '../ui/preset-card';
import { StatusMessage } from '../ui/status-message';
import type { CompareSceneStore } from './compare-scene';
import type { StudioController, StudioState } from './controller';
import {
  comparePresetIds,
  defaultDividerFraction,
  getComparePresetPatch,
  isComparePresetId,
  isPresetApplied,
  renderCompareSvg,
  type ComparePresetId,
} from './wipe-compare';

/**
 * Desktop preset compare: the preset strip above the footer and, in 2D, the A/B wipe over the
 * viewport. Hovering or focusing a card previews it as side B; clicking one starts the compare.
 */
export function CompareHost({
  controller: c,
  state,
  scenes,
}: {
  controller: StudioController;
  state: StudioState;
  scenes: CompareSceneStore;
}): ReactNode {
  const [previewId, setPreviewId] = useState<string>();
  const { compare, comparePresetsOpen, view, collapsed } = state.workspace;

  if (!comparePresetsOpen) {
    return null;
  }

  const candidateId = previewId ?? compare?.presetId;

  return (
    <>
      {view === '2d' && candidateId !== undefined && isComparePresetId(candidateId) && (
        <CompareWipe
          controller={c}
          state={state}
          scenes={scenes}
          presetId={candidateId}
          isInteractive={compare !== null}
        />
      )}
      <section
        className="studio-compare lc-glass"
        data-ui-surface
        data-inspector={collapsed ? 'collapsed' : 'expanded'}
        aria-label="Preset comparison"
      >
        {view === '3d' && <StatusMessage kind="info">A/B compare is 2D only</StatusMessage>}
        <PresetStrip label="Preset strip">
          {comparePresetIds.map((presetId) => (
            <div
              key={presetId}
              className="studio-compare__card"
              onPointerEnter={() => {
                setPreviewId(presetId);
              }}
              onPointerLeave={() => {
                setPreviewId(undefined);
              }}
              onFocus={() => {
                setPreviewId(presetId);
              }}
              onBlur={() => {
                setPreviewId(undefined);
              }}
            >
              <PresetCard
                name={presetId}
                swatches={getSwatches(presetId)}
                isActive={isPresetApplied(state.design, presetId)}
                onSelect={() => {
                  c.startCompare(presetId);
                }}
              />
            </div>
          ))}
        </PresetStrip>
        {compare !== null && (
          <div className="studio-compare__actions">
            <Button variant="primary" size="small" onClick={c.applyCompare}>
              Apply
            </Button>
            <Button variant="secondary" size="small" onClick={c.endCompare}>
              Cancel
            </Button>
          </div>
        )}
      </section>
    </>
  );
}

// === HELPERS ===

function CompareWipe({
  controller: c,
  state,
  scenes,
  presetId,
  isInteractive,
}: {
  controller: StudioController;
  state: StudioState;
  scenes: CompareSceneStore;
  presetId: ComparePresetId;
  isInteractive: boolean;
}): ReactNode {
  const scene = useSyncExternalStore(scenes.subscribe, scenes.getSnapshot);
  const sideBMarkup = useMemo(
    () => (scene === undefined ? undefined : renderCompareSvg(scene, state.design, presetId)),
    [scene, state.design, presetId],
  );

  if (sideBMarkup === undefined) {
    return null;
  }

  return (
    <Wipe
      sideBMarkup={sideBMarkup}
      sideBBackground={getComparePresetPatch(presetId).background ?? state.design.background}
      dividerFraction={state.workspace.compare?.dividerFraction ?? defaultDividerFraction}
      onDividerChange={c.moveDivider}
      inspectorState={state.workspace.collapsed ? 'collapsed' : 'expanded'}
      isInteractive={isInteractive}
    />
  );
}

function getSwatches(presetId: ComparePresetId): string[] {
  const { background, lineColor } = getComparePresetPatch(presetId);

  return [background, lineColor].filter((colour): colour is string => colour !== undefined);
}
