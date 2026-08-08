export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded bg-muted" />
        <div className="h-4 w-64 rounded bg-muted/50" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="h-3 w-20 rounded bg-muted/50" />
            <div className="h-6 w-16 rounded bg-muted" />
            <div className="h-2.5 w-24 rounded bg-muted/30" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 rounded-lg border border-border bg-card p-4">
          <div className="h-4 w-32 rounded bg-muted mb-4" />
          <div className="h-[280px] rounded border border-dashed border-border bg-muted/20" />
        </div>
        <div className="col-span-3 rounded-lg border border-border bg-card p-4">
          <div className="h-4 w-28 rounded bg-muted mb-4" />
          <div className="h-[280px] rounded border border-dashed border-border bg-muted/20" />
        </div>
      </div>
    </div>
  );
}
