export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex gap-2">
        <div className="h-10 w-28 animate-pulse rounded bg-muted" />
        <div className="h-10 w-28 animate-pulse rounded bg-muted" />
        <div className="h-10 w-28 animate-pulse rounded bg-muted" />
      </div>
      <div className="rounded-lg border p-6">
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-10 w-full animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
