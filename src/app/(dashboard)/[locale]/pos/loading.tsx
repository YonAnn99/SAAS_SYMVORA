import { ALTO_PANEL_COMPLETO } from "@/components/dashboard/alto-panel";
import { cn } from "@/lib/utils";

export default function POSLoading() {
  return (
    <div className={cn("flex gap-4", ALTO_PANEL_COMPLETO)}>
      <div className="flex-1 space-y-4">
        <div className="h-12 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
      <div className="w-80 space-y-4">
        <div className="h-12 animate-pulse rounded bg-muted" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded bg-muted" />
          ))}
        </div>
        <div className="h-32 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
