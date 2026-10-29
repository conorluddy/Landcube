import { useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { getDesignUrl } from '../design-settings';
import { createExportPreviewSvg } from '../export/image-export';
import type { OutputRenderer } from '../types/export';
import { ModelDossier } from '../ui/model-dossier';
import type { PanelProps } from './panels';
import { buildDossierModel } from './dossier-model';
import type { HudStore } from './hud-store';

/** Adapter: builds the dossier view model from studio state and wires Print and Copy. */
export function DossierPanel({
  controller: c,
  state,
  renderer,
  hud,
}: PanelProps & { renderer: OutputRenderer; hud: HudStore }): ReactNode {
  const { generatedReliefMeters } = useSyncExternalStore(hud.subscribe, hud.getSnapshot);
  // The dossier is a snapshot: it is rebuilt when the dialog opens or the design changes.
  const generatedAt = useMemo(() => new Date(), [state.design, state.source.terrain]);
  const previewSrc = useMemo(
    () =>
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(createExportPreviewSvg(state.design, renderer))}`,
    [state.design, renderer, state.source.terrain],
  );
  const model = buildDossierModel(state, {
    styleLink: getDesignUrl(window.location.href, state.design),
    generatedAt,
    previewSrc,
    generatedRelief: generatedReliefMeters,
  });

  return (
    <ModelDossier
      model={model}
      onPrint={() => {
        window.print();
      }}
      onCopyLink={() => {
        void c.copyLink();
      }}
    />
  );
}
