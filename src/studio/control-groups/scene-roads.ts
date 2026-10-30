/*
 * Roads group (SCEN.10): mapped OSM roads draped over real terrain, fetched once per location when
 * first enabled. The status row stays mounted while the group is visible, so screen readers hear
 * download progress and failures, and so retry has a focus target.
 */
import { createRef } from 'react';
import {
  roadAttribution,
  roadAttributionUrl,
  roadWidthMmLimits,
  roadWidthMmPerModelKm,
} from '../../constants/roads';
import type { RoadDetail } from '../../types/roads';
import type { ControlGroupDefinition } from '../../ui/control-rows';
import { describeRoadNetwork, type StudioController, type StudioState } from '../controller';
import { operationErrorCodes } from '../../constants/operations';
import { getFault } from '../../constants/faults';
import { buttonRow, colourRow, hintRow, selectRow, statusRow, toggleRow } from '../control-rows';

// === PUBLIC API ===

export function buildRoadsGroup(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition {
  const style = state.scene.roads;
  const network = state.roads.network;

  return {
    id: 'roads',
    title: 'Roads',
    rows: [
      toggleRow('roads-enabled', {
        label: 'Mapped roads',
        value: style.enabled,
        disabled: !state.source.terrain,
        onChange: (isEnabled) => {
          controller.roads({ enabled: isEnabled });
        },
      }),
      selectRow('roadDetail', {
        label: 'Detail',
        value: network?.detail === 'major' ? 'major' : style.detail,
        options:
          network?.detail === 'major'
            ? roadDetailOptions.filter((option) => option.value === 'major')
            : roadDetailOptions,
        disabled: !style.enabled,
        onChange: (detail) => {
          controller.roads({ detail });
        },
      }),
      colourRow('roads-color', {
        label: 'Road color',
        value: style.color,
        disabled: !style.enabled,
        onChange: (color) => {
          controller.roads({ color });
        },
      }),
      {
        kind: 'range',
        id: 'roads-width',
        label: 'Road width',
        value: style.widthMm,
        min: roadWidthMmLimits.minimum,
        max: roadWidthMmLimits.maximum,
        step: roadWidthMmLimits.step,
        unit: ' mm',
        disabled: !style.enabled,
        onChange: (widthMm) => {
          controller.roads({ widthMm, autoWidth: false });
        },
      },
      toggleRow('roads-auto-width', {
        label: 'Auto width for area',
        value: style.autoWidth,
        disabled: !style.enabled,
        onChange: (autoWidth) => {
          controller.roads({ autoWidth });
        },
      }),
      {
        kind: 'range',
        id: 'roads-texture',
        label: 'Road texture',
        value: style.texture * 100,
        min: 0,
        max: 100,
        step: 1,
        unit: '%',
        disabled: !style.enabled,
        onChange: (percent) => {
          controller.roads({ texture: percent / 100 });
        },
      },
      statusRow('roads-status', {
        kind: state.roads.hasFailed && !state.roads.loading ? 'fault' : 'info',
        code:
          state.roads.hasFailed && !state.roads.loading
            ? getFault(operationErrorCodes.mapDataFailed).code
            : undefined,
        isAlwaysMounted: true,
        ref: roadsStatusRef,
        tabIndex: -1,
        children: describeRoadsStatus(state),
      }),
      style.enabled &&
        state.roads.canRetry &&
        buttonRow('roads-retry', {
          children: 'Retry download',
          onClick: () => {
            // Retrying unmounts this button, so keyboard focus moves to the status it updates.
            roadsStatusRef.current?.focus();
            controller.retryRoads();
          },
        }),
      hintRow(
        'roads-hint',
        `Experimental. Width is on the printed model; auto width is ${roadWidthMmPerModelKm} mm per km of model area. Tunnels and bridges are hidden. Session-only and omitted from STL.`,
      ),
      {
        kind: 'link',
        id: 'roads-attribution',
        label: roadAttribution,
        href: roadAttributionUrl,
        isExternal: true,
      },
    ],
  };
}

// === HELPERS ===

/** Builders rerun every render, so the focus target outlives them; the studio has one Roads group. */
const roadsStatusRef = createRef<HTMLDivElement>();

const roadDetailOptions: readonly { value: RoadDetail; label: string }[] = [
  { value: 'major', label: 'Major roads' },
  { value: 'all', label: 'All roads' },
  { value: 'tracks', label: 'Roads and tracks' },
];

function describeRoadsStatus(state: StudioState): string {
  const style = state.scene.roads;
  const { network } = state.roads;

  if (!state.source.terrain) {
    return 'Roads need a real location.';
  }

  if (state.model.dimensions.terrainShape === 'terraced') {
    return 'Roads are hidden on terraced models.';
  }

  if (style.enabled && network && !state.roads.loading && state.roads.status === '') {
    return describeRoadNetwork(network, style);
  }

  return state.roads.status;
}
