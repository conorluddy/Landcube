import { useEffect, useRef, type ReactNode } from 'react';
import type { CropPreview } from './crop-preview';

/** Hosts the crop preview widget: it attaches on mount and disposes on unmount. */
export function CropPreviewHost({ cropPreview }: { cropPreview: CropPreview }): ReactNode {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (host.current) {
      return cropPreview.attach(host.current);
    }
  }, [cropPreview]);

  return <div ref={host} />;
}
