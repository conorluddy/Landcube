import { Progress } from './progress';
import { Tag, type TagVariant } from './tag';

export type ExportJobStatus = 'queued' | 'meshing' | 'done' | 'failed';

export interface ExportJob {
  id: string;
  label: string;
  status: ExportJobStatus;
  /** 0 to 1. A meshing job at 0 shows an indeterminate bar, since the build reports no progress. */
  fraction: number;
  sizeBytes?: number;
  /** Failure reason, shown under the row. */
  message?: string;
}

export interface JobListProps {
  jobs: readonly ExportJob[];
  /** Accessible name of the list. */
  label?: string;
}

/** Export jobs in a polite live region (C-18): label, size, status tag, and a bar while meshing. */
export function JobList({ jobs, label = 'Export jobs' }: JobListProps): React.JSX.Element | null {
  if (jobs.length === 0) {
    return null;
  }

  return (
    <ol className="lc-job-list" aria-live="polite" aria-label={label}>
      {jobs.map((job) => (
        <li className="lc-job-list__item" key={job.id} data-status={job.status}>
          <span className="lc-job-list__label">{job.label}</span>
          {job.sizeBytes !== undefined && job.status === 'done' && (
            <span className="lc-job-list__size">{formatByteSize(job.sizeBytes)}</span>
          )}
          <Tag variant={statusTagVariants[job.status]}>{statusLabels[job.status]}</Tag>
          {job.status === 'meshing' && (
            <div className="lc-job-list__progress">
              <Progress
                label={`${job.label} progress`}
                fraction={job.fraction}
                isIndeterminate={job.fraction <= 0}
              />
            </div>
          )}
          {job.status === 'failed' && job.message !== undefined && (
            <small className="lc-job-list__message">{job.message}</small>
          )}
        </li>
      ))}
    </ol>
  );
}

// === HELPERS ===

const statusLabels: Record<ExportJobStatus, string> = {
  queued: 'Queued',
  meshing: 'Meshing',
  done: 'Done',
  failed: 'Failed',
};

const statusTagVariants: Record<ExportJobStatus, TagVariant> = {
  queued: 'outlineMuted',
  meshing: 'outlineBone',
  done: 'solidBone',
  failed: 'outlineBone',
};

const bytesPerKibibyte = 1024;

/** "812 B", "48.8 KB", "3.4 MB". */
export function formatByteSize(sizeBytes: number): string {
  if (sizeBytes < bytesPerKibibyte) {
    return `${String(Math.round(sizeBytes))} B`;
  }

  const kibibytes = sizeBytes / bytesPerKibibyte;

  if (kibibytes < bytesPerKibibyte) {
    return `${kibibytes.toFixed(1)} KB`;
  }

  return `${(kibibytes / bytesPerKibibyte).toFixed(1)} MB`;
}
