export default function CustomersLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex items-center gap-4">
        <div className="h-10 w-64 animate-pulse rounded bg-muted" />
      </div>
      <div className="rounded-lg border">
        <div className="h-12 border-b bg-muted/50" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex h-14 items-center border-b last:border-0 px-4">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="ml-auto h-4 w-16 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
