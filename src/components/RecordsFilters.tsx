type RecordsFiltersProps = {
  statusFilter: string;
  availableStatuses: string[];
  onStatusFilterChange: (value: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
};

export function RecordsFilters({
  statusFilter,
  availableStatuses,
  onStatusFilterChange,
  query,
  onQueryChange,
}: RecordsFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2 text-xs text-muted-foreground">
      <span className="text-[11px] font-medium uppercase tracking-wide">
        Filters
      </span>
      <div className="flex items-center gap-1">
        <span>Status</span>
        <select
          className="h-7 rounded-md border border-input bg-background px-2 text-xs shadow-sm"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
        >
          <option value="all">All</option>
          {availableStatuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="ml-auto flex min-w-[160px] flex-1 items-center gap-1 sm:min-w-[220px]">
        <input
          type="text"
          placeholder="Filter by user, name, error…"
          className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>
    </div>
  );
}

