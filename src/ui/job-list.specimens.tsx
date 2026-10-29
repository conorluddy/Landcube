import { JobList, type ExportJob } from './job-list';
import { defineSpecimens } from './specimens';

const mixedJobs: ExportJob[] = [
  { id: 'frame', label: 'frame STL', status: 'done', fraction: 1, sizeBytes: 1_480_000 },
  { id: 'back', label: 'back STL', status: 'meshing', fraction: 0 },
  { id: 'riser', label: 'riser STL', status: 'queued', fraction: 0 },
];

export default defineSpecimens('job-list', [
  { variant: 'mixed', width: 340, render: () => <JobList jobs={mixedJobs} /> },
  {
    variant: 'queued',
    width: 340,
    render: () => (
      <JobList
        jobs={[
          { id: 'frame', label: 'frame STL', status: 'queued', fraction: 0 },
          { id: 'back', label: 'back STL', status: 'queued', fraction: 0 },
        ]}
      />
    ),
  },
  {
    variant: 'meshing',
    state: 'progress',
    width: 340,
    render: () => (
      <JobList jobs={[{ id: 'frame', label: 'frame STL', status: 'meshing', fraction: 0.6 }]} />
    ),
  },
  {
    variant: 'done',
    width: 340,
    render: () => (
      <JobList
        jobs={[
          { id: 'frame', label: 'frame STL', status: 'done', fraction: 1, sizeBytes: 1_480_000 },
          { id: 'back', label: 'back STL', status: 'done', fraction: 1, sizeBytes: 212_000 },
        ]}
      />
    ),
  },
  {
    variant: 'failed',
    width: 340,
    render: () => (
      <JobList
        jobs={[
          {
            id: 'frame',
            label: 'frame STL',
            status: 'failed',
            fraction: 0,
            message: 'The frame mesh is not watertight. Adjust the frame and retry.',
          },
        ]}
      />
    ),
  },
  {
    variant: 'mixed',
    state: 'narrow',
    width: 280,
    render: () => (
      <JobList
        jobs={[
          {
            id: 'long',
            label: 'stacked-pedestal-upper-riser STL',
            status: 'done',
            fraction: 1,
            sizeBytes: 3_400_000,
          },
        ]}
      />
    ),
  },
]);
