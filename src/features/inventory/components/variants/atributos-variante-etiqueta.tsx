import { TIPO_COLOR, atributosDeVariante, hexDeColor, type Atributo } from "../../atributos-variante";

/**
 * Los atributos de una variante en una linea ("Fresa · 1 L · ● Rojo"), con el
 * punto del color cuando es un color conocido. Sirve igual para las variantes
 * nuevas (`atributos`) y las de antes (talla/color).
 */
export function AtributosVariante({
  variant,
  vacio = "-",
}: {
  variant: { atributos?: Atributo[] | null; talla?: string | null; color?: string | null };
  vacio?: string;
}) {
  const lista = atributosDeVariante(variant);
  if (lista.length === 0) return <span>{vacio}</span>;
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
      {lista.map((a, i) => {
        const hex = a.tipo === TIPO_COLOR ? hexDeColor(a.valor) : null;
        return (
          <span key={`${a.tipo}-${i}`} className="inline-flex min-w-0 items-center gap-1" title={a.tipo}>
            {i > 0 && <span aria-hidden="true" className="opacity-60">·</span>}
            {hex && (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/15 dark:border-white/20"
                style={{ backgroundColor: hex }}
                aria-hidden="true"
              />
            )}
            <span className="truncate">{a.valor}</span>
          </span>
        );
      })}
    </span>
  );
}
