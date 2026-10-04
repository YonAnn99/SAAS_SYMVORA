import type { ReactNode } from "react";

interface EncabezadoModuloProps {
  titulo: ReactNode;
  descripcion: ReactNode;
  /** Icono antes del título (Sugerencias). */
  icono?: ReactNode;
}

/**
 * Título y descripción de la pantalla de un módulo.
 *
 * En escritorio el header ya muestra el nombre del módulo, así que aquí se
 * oculta el título y la descripción pasa a ser el texto principal, en negritas.
 * En celular y tablet el header muestra el logo de SYMVORA: el título de la
 * pantalla es la única referencia del módulo y se queda con su subtítulo.
 */
export function EncabezadoModulo({ titulo, descripcion, icono }: EncabezadoModuloProps) {
  return (
    <>
      <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight md:text-2xl lg:hidden">
        {icono}
        {titulo}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground lg:mt-0 lg:text-xl lg:font-semibold lg:tracking-tight lg:text-foreground">
        {descripcion}
      </p>
    </>
  );
}
