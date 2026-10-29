import { defineSpecimens } from '../specimens';
import { ReadoutCard } from './readout-card';

const realCells = [
  { label: 'Lat', value: '55.0343°N' },
  { label: 'Lon', value: '8.1130°W' },
  { label: 'Span', value: '8 × 8', unit: 'km' },
  { label: 'Contour', value: '20', unit: 'm' },
  { label: 'Low', value: '12', unit: 'm' },
  { label: 'High', value: '751', unit: 'm' },
];

export default defineSpecimens('readout-card', [
  {
    variant: 'realTerrain',
    render: () => (
      <ReadoutCard
        title="Errigal"
        place="Ireland"
        sourceLabel="EU-DEM"
        signalKind="ok"
        cells={realCells}
        scaleBar={{ totalKm: 2, lengthPx: 248 }}
        attribution="Produced using Copernicus data and information funded by the European Union — EU-DEM layers"
      />
    ),
  },
  {
    variant: 'procedural3d',
    render: () => (
      <ReadoutCard
        title="Procedural"
        place="Seed 123"
        sourceLabel="Generated"
        signalKind="live"
        cells={[
          { label: 'Seed', value: '123' },
          { label: 'Contours', value: '12', unit: 'levels' },
          { label: 'Low', value: '' },
          { label: 'High', value: '' },
          { label: 'Azimuth', value: '312°' },
          { label: 'Elevation', value: '34°' },
        ]}
      />
    ),
  },
  {
    variant: 'realTerrain',
    state: 'long',
    render: () => (
      <ReadoutCard
        title="Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch"
        place="Isle of Anglesey, Wales, United Kingdom"
        sourceLabel="USGS · ETOPO1 · EA"
        signalKind="ok"
        cells={realCells.slice(0, 4)}
      />
    ),
  },
]);
