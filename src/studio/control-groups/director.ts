/*
 * Director section (DRCT.01): bookmarked 3D camera shots and their looping tour. Session-only.
 * The pattern is in ./README.md.
 */
import { createElement } from 'react';
import type { ControlGroupDefinition } from '../../ui/control-rows';
import type { StudioController, StudioState } from '../controller';
import { buttonRow, customRow, hintRow } from '../control-rows';
import { ShotStrip } from '../shot-strip';

// === PUBLIC API ===

export function buildDirectorGroups(
  controller: StudioController,
  state: StudioState,
): ControlGroupDefinition[] {
  return [buildShotsGroup(controller, state)];
}

// === GROUPS ===

function buildShotsGroup(controller: StudioController, state: StudioState): ControlGroupDefinition {
  const { shots, isPlaying } = state.cameraShots;

  return {
    id: 'director-shots',
    title: 'Shots',
    rows: [
      shots.length > 0
        ? customRow('director-shot-strip', () => createElement(ShotStrip, { controller, shots }))
        : hintRow(
            'director-empty',
            'Frame a view and press B to save it as a shot. P plays the shots as a looping tour.',
          ),
      buttonRow('director-add-shot', {
        children: 'Add shot',
        onClick: () => {
          controller.saveCameraShot();
        },
      }),
      buttonRow('director-play', {
        children: isPlaying ? 'Stop' : 'Play',
        disabled: shots.length === 0,
        onClick: () => {
          controller.toggleCameraShotPlayback();
        },
      }),
      buttonRow('director-clear', {
        children: 'Clear shots',
        disabled: shots.length === 0,
        onClick: () => {
          controller.clearCameraShots();
        },
      }),
    ],
  };
}
