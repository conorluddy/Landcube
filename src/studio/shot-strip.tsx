import { useRef, type ReactNode } from 'react';
import type { StudioController, StudioState } from './controller';

/** Saved camera shots in tour order: click a tile to fly there, × to drop it. */
export function ShotStrip({
  controller,
  shots,
}: {
  controller: StudioController;
  shots: StudioState['cameraShots']['shots'];
}): ReactNode {
  const strip = useRef<HTMLOListElement>(null);

  // The focused × unmounts with its tile, so focus moves on rather than dropping to the page.
  const removeShot = (id: number, index: number) => {
    const tiles = strip.current?.querySelectorAll<HTMLElement>('.lc-shot-strip__view');
    const nextFocus =
      tiles?.item(index + 1) ??
      tiles?.item(index - 1) ??
      document.querySelector<HTMLElement>('#director-add-shot button, button#director-add-shot');

    controller.removeCameraShot(id);
    nextFocus?.focus();
  };

  return (
    <ol ref={strip} className="lc-shot-strip" aria-label="Saved shots">
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
              removeShot(shot.id, index);
            }}
          >
            ×
          </button>
        </li>
      ))}
    </ol>
  );
}
