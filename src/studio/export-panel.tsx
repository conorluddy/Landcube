import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Group, Hint, NumberField, Select, Toggle } from './fields';
import type { PanelProps } from './panels';
import type { OutputRenderer } from '../types/export';
import {
  createExportFile,
  createExportPreviewSvg,
  downloadExport,
  getRasterDimensions,
} from '../export/image-export';
import {
  maximumExtraLargeOutputDimensionPixels,
  maximumOutputDimensionPixels,
  minimumOutputDimensionPixels,
} from '../constants/design';
import { outputSizePresetGroups } from '../constants/export';
import { clampOutputDimensionPixels } from '../design-settings';

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export function ExportPanel({
  controller: c,
  state: s,
  renderer,
}: PanelProps & { renderer: OutputRenderer }): ReactNode {
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState('custom');
  const [invalid, setInvalid] = useState(false);
  const fields = useRef<HTMLDivElement>(null);
  const settings = s.design;
  const limit = settings.allowExtraLargeExports
    ? maximumExtraLargeOutputDimensionPixels
    : maximumOutputDimensionPixels;

  const activePreview = useRef<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let pendingUrl: string | undefined;
    const frame = requestAnimationFrame(() => {
      void (async () => {
        try {
          pendingUrl = URL.createObjectURL(
            new Blob([createExportPreviewSvg(settings, renderer)], { type: 'image/svg+xml' }),
          );
          const image = new Image();

          image.src = pendingUrl;
          await image.decode();

          if (cancelled) {
            URL.revokeObjectURL(pendingUrl);

            return;
          }

          const previous = activePreview.current;

          activePreview.current = pendingUrl;
          setPreview(pendingUrl);
          pendingUrl = undefined;
          setError('');

          if (previous !== undefined) {
            URL.revokeObjectURL(previous);
          }
        } catch (failure) {
          if (pendingUrl !== undefined) {
            URL.revokeObjectURL(pendingUrl);
          }

          if (!cancelled) {
            setError(
              failure instanceof Error ? failure.message : 'Preview could not be generated.',
            );
          }
        }
      })();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [settings, renderer, s.source.terrain]);
  useEffect(
    () => () => {
      if (activePreview.current !== undefined) {
        URL.revokeObjectURL(activePreview.current);
      }
    },
    [],
  );
  const raster = getRasterDimensions(settings);

  const download = async () => {
    setBusy(true);
    setError('');

    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            resolve();
          }),
        ),
      );
      const result = await createExportFile(settings, renderer);
      const downloaded = result.ok ? downloadExport(result.data) : result;

      if (!downloaded.ok) {
        setError(downloaded.error.message);
      } else {
        c.notify('Download started.');
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Export failed. Please retry.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Group title="2D image">
        <Hint>Exports settled 2D artwork. Cursor deformation and the 3D scene are excluded.</Hint>
        <Select
          id="format"
          label="Format"
          value={settings.format}
          options={[
            { value: 'svg', label: 'SVG' },
            { value: 'png', label: 'PNG' },
          ]}
          onChange={(value) => c.design({ format: value })}
        />
        <div className="field-row">
          <label htmlFor="output-size">Size</label>
          <select
            id="output-size"
            value={size}
            onChange={(event) => {
              const value = event.target.value;

              setSize(value);

              if (value === 'custom') {
                return;
              }

              const [width, height] =
                value === 'viewport'
                  ? [window.innerWidth, window.innerHeight]
                  : value === 'screen'
                    ? [
                        window.screen.width * devicePixelRatio,
                        window.screen.height * devicePixelRatio,
                      ]
                    : value.split('x').map(Number);

              c.design({
                width: clampOutputDimensionPixels(Math.round(width)),
                height: clampOutputDimensionPixels(Math.round(height)),
              });

              if (value === 'viewport' || value === 'screen') {
                setSize('custom');
              }
            }}
          >
            <option value="custom">Custom</option>
            <optgroup label="This device">
              <option value="viewport">Current viewport</option>
              <option value="screen">Device screen</option>
            </optgroup>
            {outputSizePresetGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.presets.map((preset) => (
                  <option value={preset.value} key={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <Toggle
          label="Allow extra-large exports"
          value={settings.allowExtraLargeExports}
          onChange={(value) =>
            c.design({
              allowExtraLargeExports: value,
              ...(!value
                ? {
                    width: Math.min(settings.width, maximumOutputDimensionPixels),
                    height: Math.min(settings.height, maximumOutputDimensionPixels),
                  }
                : {}),
            })
          }
        />
        {settings.allowExtraLargeExports && (
          <Hint>
            Up to 12,288 px per side. Large PNGs can use over 576 MiB of memory and may freeze this
            tab.
          </Hint>
        )}
        <div
          className="control-grid"
          ref={fields}
          onBlur={() => {
            requestAnimationFrame(() => {
              setInvalid(fields.current?.querySelector('[aria-invalid="true"]') !== null);
            });
          }}
          onInput={() => {
            setInvalid(true);
          }}
        >
          <NumberField
            id="width"
            label="Width"
            value={settings.width}
            min={minimumOutputDimensionPixels}
            max={limit}
            step={1}
            onChange={(value) => {
              setSize('custom');

              return value !== undefined && c.design({ width: value });
            }}
          />
          <NumberField
            id="height"
            label="Height"
            value={settings.height}
            min={minimumOutputDimensionPixels}
            max={limit}
            step={1}
            onChange={(value) => {
              setSize('custom');

              return value !== undefined && c.design({ height: value });
            }}
          />
        </div>
        <Hint>
          {minimumOutputDimensionPixels}–{limit} px per side · anchored at the top left
        </Hint>
        {settings.format === 'png' && (
          <Select
            id="pngScale"
            label="Resolution"
            value={String(settings.pngScale)}
            options={['1', '2']}
            onChange={(value) => c.design({ pngScale: Number(value) as 1 | 2 })}
          />
        )}
        <Toggle
          label="Transparent background"
          value={settings.transparent}
          onChange={(value) => c.design({ transparent: value })}
        />
        <div className="output-preview">
          {preview !== '' && (
            <img
              id="output-preview-image"
              src={preview}
              alt="Settled landscape export preview"
              onError={() => {
                setError('Export preview could not be displayed.');
              }}
            />
          )}
        </div>
        <Hint>
          {settings.width * (settings.format === 'png' ? settings.pngScale : 1)} ×{' '}
          {settings.height * (settings.format === 'png' ? settings.pngScale : 1)} px · cursor hill
          excluded
        </Hint>
        {!raster.ok && settings.format === 'png' && <p role="alert">{raster.error.message}</p>}
        {error !== '' && <p role="alert">{error}</p>}
        <Button
          primary
          disabled={busy || invalid || (!raster.ok && settings.format === 'png')}
          onClick={() => {
            void download();
          }}
        >
          {busy ? 'Generating…' : `Download ${settings.format.toUpperCase()}`}
        </Button>
      </Group>
      {s.workspace.view === '3d' && (
        <Group title="STL model">
          <Hint>
            {s.model.dimensions.widthMm}{' '}
            {s.model.dimensions.cropShape === 'circle'
              ? 'mm diameter'
              : `× ${s.model.dimensions.lengthMm} mm`}{' '}
            · {s.metrics.height?.toFixed(2) ?? '—'} mm overall height
          </Hint>
          <Hint>
            Terrain and solid base, in millimeters. Scene materials, water, decorations and engraved
            grooves are excluded.
          </Hint>
          <Button
            primary
            onClick={() => {
              c.downloadStl();
            }}
          >
            Download STL
          </Button>
          {s.source.terrain && (
            <>
              <Hint>{s.source.terrain.attribution}</Hint>
              <Button
                onClick={() => {
                  downloadBlob(
                    new Blob([s.source.terrain?.attribution ?? ''], { type: 'text/plain' }),
                    `topogra-${settings.seed}-attribution.txt`,
                  );
                }}
              >
                Download attribution
              </Button>
            </>
          )}
        </Group>
      )}
    </>
  );
}
