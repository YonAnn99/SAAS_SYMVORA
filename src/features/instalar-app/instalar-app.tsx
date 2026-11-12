"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import Image from "next/image";
import { CheckCircle2, Download, Monitor, RefreshCw, Smartphone } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { useEsAppAndroid } from "@/features/app-android/use-es-app-android";
import { detectarPlataforma, pasosParaInstalar, type Plataforma } from "./plataforma";
import { useInstalarApp } from "./use-instalar-app";

/** Texto de cada ventaja: `install.benefits.<n>`. */
const VENTAJAS = [
  { icono: Monitor, clave: "0" },
  { icono: RefreshCw, clave: "1" },
  { icono: Smartphone, clave: "2" },
];

/**
 * Instalar SYMVORA como programa (PWA). Con Chrome/Edge, un boton abre el
 * dialogo del navegador; en los demas, los pasos a mano para su navegador.
 */
export function InstalarApp() {
  const { puedeInstalar, instalada, instalar } = useInstalarApp();
  const enAppAndroid = useEsAppAndroid();
  const [plataforma, setPlataforma] = useState<Plataforma | null>(null);
  const [aceptada, setAceptada] = useState(false);
  const t = useTranslations("install");

  useEffect(() => {
    // El userAgent solo existe en el navegador: diferido para no chocar con el render del servidor.
    const t = window.setTimeout(() => setPlataforma(detectarPlataforma(navigator.userAgent)), 0);
    return () => window.clearTimeout(t);
  }, []);

  const lista = instalada || aceptada || enAppAndroid;
  const instrucciones = plataforma ? pasosParaInstalar(plataforma) : null;

  return (
    <div className="mx-auto w-full max-w-md space-y-6 rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-xl sm:p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Image src="/icons/icon-maskable-192.png" alt="" width={72} height={72} className="rounded-2xl" />
        <h1 className="text-2xl font-bold tracking-tight">
          {lista ? t("installed") : t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {enAppAndroid
            ? t("usingApp")
            : lista
              ? t("findIt")
              : t("worksOn")}
        </p>
      </div>

      {lista ? (
        <div className="flex flex-col items-center gap-3">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden />
          <Link href="/dashboard" className={buttonVariants({ className: "w-full" })}>
            {t("open")}
          </Link>
        </div>
      ) : puedeInstalar ? (
        <Button
          className="h-12 w-full gap-2 text-base"
          onClick={async () => setAceptada(await instalar())}
        >
          <Download className="h-5 w-5" aria-hidden />
          {t("install")}
        </Button>
      ) : (
        instrucciones && (
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="mb-2 text-sm font-semibold">{t(`steps.${plataforma}.title`)}</p>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
              {instrucciones.pasos.map((p, i) => (
                <li key={p}>{t(`steps.${plataforma}.${i}`)}</li>
              ))}
            </ol>
          </div>
        )
      )}

      {!lista && (
        <ul className="space-y-2.5 border-t border-border pt-5">
          {VENTAJAS.map(({ icono: Icono, clave }) => (
            <li key={clave} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <Icono className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              {t(`benefits.${clave}`)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
