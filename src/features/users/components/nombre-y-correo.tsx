import { cn } from "@/lib/utils";

/**
 * Nombre arriba (en negritas) y correo abajo (en gris). Sin nombre, solo el
 * correo, como se veia antes de que la invitacion pidiera nombre.
 */
export function NombreYCorreo({
  nombre,
  email,
  className,
}: {
  nombre: string | null | undefined;
  email: string | null | undefined;
  className?: string;
}) {
  const nombreLimpio = nombre?.trim();
  return (
    <div className={cn("min-w-0", className)}>
      <p className="truncate text-sm font-medium">{nombreLimpio || email || "N/A"}</p>
      {nombreLimpio && email && (
        <p className="truncate text-xs text-muted-foreground">{email}</p>
      )}
    </div>
  );
}
