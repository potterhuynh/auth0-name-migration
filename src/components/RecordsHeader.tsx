import { Button } from './ui/button';

type RecordsHeaderProps = {
  jobs: any[];
  selectedJobId: string | null;
  onSelectedJobIdChange: (id: string | null) => void;
  selectedJob: any | null;
  onStartMigration: () => void;
};

export function RecordsHeader({
  jobs,
  selectedJobId,
  onSelectedJobIdChange,
  selectedJob,
  onStartMigration,
}: RecordsHeaderProps) {
  return (
    <div className="flex flex-shrink-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-sm font-semibold">Records management</h2>
        <p className="text-xs text-muted-foreground">
          Inspect individual migration records for a specific job.
        </p>
      </div>
      <div className="flex flex-col items-stretch gap-2 text-xs sm:flex-row sm:items-end sm:justify-end">
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-muted-foreground">
            Job
          </label>
          <select
            className="h-8 min-w-[160px] rounded-md border border-input bg-background px-2 text-xs shadow-sm"
            value={selectedJobId ?? ''}
            onChange={(e) => onSelectedJobIdChange(e.target.value || null)}
          >
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.job_key} — {job.status}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          size="sm"
          className="sm:ml-2"
          disabled={!selectedJob}
          onClick={onStartMigration}
        >
          Start migration
        </Button>
      </div>
    </div>
  );
}

