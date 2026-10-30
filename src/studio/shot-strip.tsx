import type { ReactNode } from 'react';
import type { StudioController, StudioState } from './controller';

/** Saved camera shots in tour order: click a tile to fly there, × to drop it. */
export function ShotStrip({
  controller,
  shots,
}: {
  controller: StudioController;
  shots: StudioState['cameraShots']['shots'];
}): ReactNode {
  return (
    <ol className="lc-shot-strip" aria-label="Saved shots">
      {shots.map((shot, index) => (
        <li key={shot.id} className="lc-shot-strip__tile">
          <button
            type="button"
            className="lc-shot-strip__view"
            aria-label={`Fly to shot ${index + 1}`}
            onClick={() => {
              controller.flyToCameraShot(shot.id);
            }}
          >
            <img src={shot.thumbnailUrl} alt="" />
            <span className="lc-shot-strip__number">{index + 1}</span>
          </button>
          <button
            type="button"
            className="lc-shot-strip__remove"
            aria-label={`Remove shot ${index + 1}`}
            onClick={() => {
              controller.removeCameraShot(shot.id);
            }}
          >
            ×
          </button>
        </li>
      ))}
    </ol>
  );
}
