import { useEffect, useState } from 'react';
import { FaultCard } from '../ui/fault-card';
import { LoaderCard } from '../ui/loader-card';
import { NoDataHatch } from '../ui/overlays/no-data-hatch';
import { TileResolve } from '../ui/overlays/tile-resolve';
import type { StudioController, StudioState } from './controller';

/** Quick loads (the bundled default place) finish before a loader would only flicker. */
const loaderRevealDelayMs = 300;

/**
 * Loading and fault surfaces over the viewport (#96). A small wrapper until the HUD layer
 * (#95) can host them; it sits inside `.studio-shell` and lets pointer events through.
 */
export function ViewportStates({
  controller,
  state,
}: {
  controller: StudioController;
  state: StudioState;
}): React.JSX.Element | null {
  const { source } = state;
  const isLoaderVisible = useIsDelayedTrue(source.loading, loaderRevealDelayMs);
  const { fault } = source;

  if (!isLoaderVisible && fault === null) {
    return null;
  }

  const progress = source.loadProgress;
  const hasProgress = progress !== null && progress.total > 0;

  return (
    <div className="studio-viewport-states">
      {fault !== null && !source.terrain && <NoDataHatch />}
      {isLoaderVisible && (
        <>
          <TileResolve loadedTiles={progress?.loaded ?? 0} totalTiles={progress?.total ?? 0} />
          <div className="studio-viewport-states__card">
            <LoaderCard
              title="Loading terrain"
              fraction={hasProgress ? progress.loaded / progress.total : NaN}
              detail={hasProgress ? `${progress.loaded} of ${progress.total} tiles` : undefined}
              onCancel={() => {
                controller.cancelTerrainLoad();
              }}
            />
          </div>
        </>
      )}
      {fault !== null && !source.loading && (
        <div className="studio-viewport-states__card">
          <FaultCard
            code={fault.code}
            title={fault.title}
            metric={fault.metric}
            primaryAction={
              fault.isRetryable
                ? {
                    label: 'Retry',
                    onClick: () => {
                      void controller.loadTerrain();
                    },
                  }
                : {
                    label: 'Dismiss',
                    onClick: () => {
                      controller.dismissTerrainFault();
                    },
                  }
            }
            secondaryActions={[
              ...(fault.isRetryable
                ? [
                    {
                      label: 'Dismiss',
                      onClick: () => {
                        controller.dismissTerrainFault();
                      },
                    },
                  ]
                : []),
              {
                label: 'Use procedural',
                onClick: () => {
                  controller.useGenerated();
                },
              },
            ]}
          >
            {fault.message}
          </FaultCard>
        </div>
      )}
    </div>
  );
}

// === HELPERS ===

/** True once `value` has held for `delayMs`; false immediately when it drops. */
function useIsDelayedTrue(value: boolean, delayMs: number): boolean {
  const [isDelayedTrue, setIsDelayedTrue] = useState(false);

  useEffect(() => {
    if (!value) {
      setIsDelayedTrue(false);

      return;
    }

    const timer = setTimeout(() => {
      setIsDelayedTrue(true);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return isDelayedTrue;
}
