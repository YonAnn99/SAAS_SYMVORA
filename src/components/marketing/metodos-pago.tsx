/**
 * Metodos con los que se paga la suscripcion de SYMVORA (checkout de Conekta;
 * ver `features/payments/metodo-pago-conekta.ts`): tarjeta (Visa y Mastercard),
 * SPEI, Aplazo y efectivo en tiendas. Solo unos cuantos a proposito: no se
 * listan todas las tiendas ni cada banco. Si cambian los metodos activos en
 * Conekta, cambia esta lista.
 *
 * Cada marca va en una insignia blanca (se lee igual en claro y oscuro). Visa,
 * Mastercard y SPEI se dibujan en SVG/texto; Aplazo, 7-Eleven y Farmacias del
 * Ahorro usan sus logos (`public/landing/pagos`).
 */

import Image from "next/image";

const INSIGNIA =
  "inline-flex h-8 items-center justify-center rounded-md border border-zinc-200 bg-white px-2.5 shadow-sm select-none";

function Visa() {
  return (
    <span className={INSIGNIA} role="listitem" aria-label="Visa">
      <span className="text-[15px] font-black italic tracking-tight text-[#1A1F71]" aria-hidden="true">
        VISA
      </span>
    </span>
  );
}

function Mastercard() {
  return (
    <span className={INSIGNIA} role="listitem" aria-label="Mastercard">
      <svg width="30" height="19" viewBox="0 0 30 19" aria-hidden="true">
        <circle cx="10.5" cy="9.5" r="9" fill="#EB001B" />
        <circle cx="19.5" cy="9.5" r="9" fill="#F79E1B" />
        <path d="M15 2.4a9 9 0 0 1 0 14.2 9 9 0 0 1 0-14.2z" fill="#FF5F00" />
      </svg>
    </span>
  );
}

function Spei() {
  return (
    <span className={INSIGNIA} role="listitem" aria-label="SPEI">
      <span className="text-[13px] font-extrabold tracking-wider text-zinc-800" aria-hidden="true">
        SPEI
      </span>
    </span>
  );
}

/** Logo oficial (archivos en `public/landing/pagos`, ya recortados). `h-*`: alto del logo dentro de la insignia. */
function LogoTienda({ nombre, archivo, ancho, alto, alturaClase }: { nombre: string; archivo: string; ancho: number; alto: number; alturaClase: string }) {
  return (
    <span className={INSIGNIA} role="listitem" aria-label={nombre}>
      <Image src={`/landing/pagos/${archivo}.webp`} alt="" aria-hidden="true" width={ancho} height={alto} unoptimized draggable={false} className={`${alturaClase} w-auto select-none`} />
    </span>
  );
}

function Aplazo() {
  // El logo de Aplazo trae su propio fondo (cian): es la insignia entera.
  return (
    <span className="inline-flex h-8 items-center overflow-hidden rounded-md border border-zinc-200 shadow-sm select-none" role="listitem" aria-label="Aplazo">
      <Image src="/landing/pagos/aplazo.webp" alt="" aria-hidden="true" width={238} height={64} unoptimized draggable={false} className="h-full w-auto" />
    </span>
  );
}

export function MetodosPago() {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Métodos de pago</h3>
      <div role="list" aria-label="Métodos de pago aceptados" className="flex flex-wrap items-center gap-2">
        <Visa />
        <Mastercard />
        <Spei />
        <Aplazo />
        <LogoTienda nombre="7-Eleven" archivo="7-eleven" ancho={351} alto={64} alturaClase="h-[18px]" />
        <LogoTienda nombre="Farmacias del Ahorro" archivo="farmacias-del-ahorro" ancho={161} alto={64} alturaClase="h-6" />
        <span className="text-xs text-zinc-500 dark:text-zinc-400" role="listitem">y más</span>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Tarjeta de crédito o débito, transferencia, Aplazo y efectivo en tiendas. Pagos procesados de forma segura por Conekta.
      </p>
    </div>
  );
}
