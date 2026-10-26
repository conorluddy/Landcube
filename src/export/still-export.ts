export const terrainStillScales = [1, 2, 4] as const;
export type TerrainStillScale = (typeof terrainStillScales)[number];

/** Encodes a captured 3D frame as PNG, stamping real-terrain attribution bottom-left like SVG exports. */
export async function encodeTerrainStill(
  frame: HTMLCanvasElement,
  attribution: string | undefined,
): Promise<Blob> {
  if (attribution !== undefined) {
    drawAttribution(frame, attribution);
  }

  return new Promise((resolve, reject) => {
    frame.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('The 3D still could not be encoded. Try a smaller scale.'));
      }
    }, 'image/png');
  });
}

// === HELPERS ===

function drawAttribution(frame: HTMLCanvasElement, attribution: string): void {
  const context = frame.getContext('2d');

  if (!context) {
    throw new Error('The 3D still could not be annotated with its terrain attribution.');
  }

  // Sized from the frame so 1×, 2× and 4× stills keep the same proportions.
  const fontSizePx = Math.max(9, frame.height / 70);
  const marginPx = fontSizePx;

  context.font = `${fontSizePx}px sans-serif`;
  context.textBaseline = 'bottom';
  context.shadowColor = 'rgba(0, 0, 0, 0.6)';
  context.shadowBlur = fontSizePx / 3;
  context.fillStyle = 'rgba(255, 255, 255, 0.85)';
  context.fillText(attribution, marginPx, frame.height - marginPx, frame.width - marginPx * 2);
}
