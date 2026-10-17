"use client";

import { useEffect, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { CheckCircle2, Loader2, Store } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TelefonoInput } from "@/components/ui/telefono-input";
import { aE164, PAIS_POR_DEFECTO } from "@/lib/telefono";
import { agregarMiTarjeta, leerMisTarjetas, nombreAltaValido, type MiTarjeta } from "../lealtad";
import type { ResultadoAlta } from "../types";

const CLAVE_MIS_TARJETAS = "symvora-mis-tarjetas";

function misTarjetas(): MiTarjeta[] {
  try {
    return leerMisTarjetas(window.localStorage.getItem(CLAVE_MIS_TARJETAS));
  } catch {
    return [];
  }
}

function guardarMiTarjeta(nueva: MiTarjeta) {
  try {
    window.localStorage.setItem(CLAVE_MIS_TARJETAS, JSON.stringify(agregarMiTarjeta(misTarjetas(), nueva)));
  } catch {
    // Sin almacenamiento (modo privado): la tarjeta se abre igual.
  }
}

/**
 * Formulario del cartel (migracion 121): nombre, celular, aviso y Turnstile.
 * Lo valida otra vez POST /api/lealtad/unirse y, al final, la base.
 *
 * Si en ESTE celular ya se saco la tarjeta de este cartel, se ofrece abrirla
 * (localStorage). Un celular que ya existe en el negocio nunca recibe su
 * tarjeta por aqui: se le pide ir a caja.
 */
export function FormularioAlta({
  codigoAlta,
  negocio,
  avisoNegocioUrl,
}: {
  codigoAlta: string;
  negocio: string;
  avisoNegocioUrl: string | null;
}) {
  const router = useRouter();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [yaTengo, setYaTengo] = useState<string | null>(null);
  const [otraPersona, setOtraPersona] = useState(false);
  const [nombre, setNombre] = useState("");
  const [pais, setPais] = useState(PAIS_POR_DEFECTO);
  const [numero, setNumero] = useState("");
  const [acepto, setAcepto] = useState(false);
  const [sitio, setSitio] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repetido, setRepetido] = useState(false);
  const [tocado, setTocado] = useState(false);

  // Diferido: en el servidor no hay localStorage (react-hooks/set-state-in-effect).
  useEffect(() => {
    const t = window.setTimeout(() => {
      setYaTengo(misTarjetas().find((m) => m.codigoAlta === codigoAlta)?.codigo ?? null);
    }, 0);
    return () => window.clearTimeout(t);
  }, [codigoAlta]);

  const nombreOk = nombreAltaValido(nombre);
  const telefono = aE164(pais, numero);
  const listo = nombreOk && Boolean(telefono) && acepto && (Boolean(token) || !siteKey) && !enviando;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setTocado(true);
    if (!listo) return;
    setEnviando(true);
    setError(null);
    setRepetido(false);
    try {
      const res = await fetch("/api/lealtad/unirse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigoAlta, nombre, pais, numero, acepto: true, token, sitio }),
      });
      const cuerpo = (await res.json().catch(() => null)) as (ResultadoAlta & { error?: string }) | null;
      if (!res.ok || !cuerpo) throw new Error(cuerpo?.error ?? "No se pudo crear tu tarjeta. Intenta de nuevo.");
      if (cuerpo.estado === "ya_registrado") {
        setRepetido(true);
        return;
      }
      guardarMiTarjeta({ codigoAlta, codigo: cuerpo.codigo });
      router.push(`/tarjeta/${cuerpo.codigo}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear tu tarjeta. Intenta de nuevo.");
    } finally {
      setEnviando(false);
      // Un token de Turnstile sirve una sola vez.
      turnstileRef.current?.reset();
      setToken(null);
    }
  };

  if (yaTengo && !otraPersona) {
    return (
      <div className="w-full max-w-md space-y-3 rounded-2xl border border-border bg-card p-5 text-center text-card-foreground">
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <p className="font-medium">Ya tienes tu tarjeta de {negocio}</p>
        <Link href={`/tarjeta/${yaTengo}`} className={buttonVariants({ className: "w-full" })}>
          Abrir mi tarjeta
        </Link>
        <button
          type="button"
          onClick={() => setOtraPersona(true)}
          className="text-xs text-muted-foreground underline underline-offset-2"
        >
          Registrar a otra persona
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={enviar}
      noValidate
      className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-5 text-card-foreground"
    >
      <div>
        <h1 className="text-lg font-semibold">Obtén tu tarjeta de lealtad</h1>
        <p className="text-sm text-muted-foreground">Gratis, sin crear cuenta y sin descargar apps.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="alta-nombre">Tu nombre</Label>
        <Input
          id="alta-nombre"
          value={nombre}
          maxLength={60}
          autoComplete="name"
          onChange={(e) => setNombre(e.target.value)}
          aria-invalid={tocado && !nombreOk}
          placeholder="Ej. Ana López"
        />
        {tocado && !nombreOk && <p className="text-xs text-destructive">Escribe tu nombre (de 2 a 60 letras).</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="alta-celular">Tu celular</Label>
        <TelefonoInput
          id="alta-celular"
          pais={pais}
          numero={numero}
          onPaisChange={setPais}
          onNumeroChange={setNumero}
          invalido={tocado && !telefono}
          placeholder="10 dígitos"
          required
        />
        {tocado && !telefono && <p className="text-xs text-destructive">Revisa tu número de celular.</p>}
      </div>

      {/* Trampa para bots: fuera de la vista y del teclado; una persona nunca la llena. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="alta-sitio">Sitio web</label>
        <input id="alta-sitio" tabIndex={-1} autoComplete="off" value={sitio} onChange={(e) => setSitio(e.target.value)} />
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
        <Checkbox className="mt-0.5" checked={acepto} onCheckedChange={(v) => setAcepto(v === true)} />
        <span>
          Acepto que <span className="font-medium text-foreground">{negocio}</span> use mi nombre y celular solo para
          mi tarjeta de lealtad.{" "}
          {avisoNegocioUrl && (
            <>
              <a href={avisoNegocioUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                Aviso de privacidad del negocio
              </a>
              {" · "}
            </>
          )}
          <Link href="/aviso-privacidad" target="_blank" className="underline underline-offset-2">
            Aviso de SYMVORA
          </Link>
        </span>
      </label>
      {tocado && !acepto && <p className="-mt-2 text-xs text-destructive">Acepta el aviso para continuar.</p>}

      {siteKey && (
        <div className="flex justify-center">
          <Turnstile
            id="cf-turnstile-alta-lealtad"
            siteKey={siteKey}
            onSuccess={setToken}
            onError={() => setToken(null)}
            onExpire={() => setToken(null)}
            ref={turnstileRef}
          />
        </div>
      )}
      {siteKey && tocado && !token && !enviando && (
        <p className="-mt-2 text-center text-xs text-muted-foreground">Completa la verificación de arriba para continuar.</p>
      )}

      {repetido && (
        <div className="flex gap-2.5 rounded-xl bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          <Store className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Este celular ya está registrado en {negocio}. Pide tu tarjeta en caja y te la comparten al momento.
          </p>
        </div>
      )}
      {error && <p className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full gap-1.5" disabled={enviando || (tocado && !listo)}>
        {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Obtener mi tarjeta
      </Button>
    </form>
  );
}
