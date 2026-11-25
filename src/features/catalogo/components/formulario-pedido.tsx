"use client";

import { useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { TelefonoInput } from "@/components/ui/telefono-input";
import { aE164, PAIS_POR_DEFECTO } from "@/lib/telefono";
import { nombreAltaValido } from "@/features/lealtad/lealtad";
import { DIRECCION_MAX, NOTA_MAX, direccionValida, lineasAItems, type EntregaPedido, type ResultadoPedido } from "../pedido-envio";
import type { LineaPedido } from "../pedido";

/**
 * Datos del cliente final al mandar su pedido desde el catálogo (migración 141): nombre, celular, recoger o
 * domicilio, nota, aviso de privacidad y Turnstile. Lo valida otra vez `POST /api/catalogo/[slug]/pedido` y, al
 * final, la base. Si todo sale bien, vacía el carrito y lleva a la página de seguimiento.
 *
 * El catálogo público va siempre en español (como la tarjeta de lealtad), por eso los textos son fijos.
 */
export function FormularioPedido({
  slug,
  negocio,
  lineas,
  color,
  onEnviado,
}: {
  slug: string;
  negocio: string;
  lineas: LineaPedido[];
  color: string;
  onEnviado: () => void;
}) {
  const router = useRouter();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [nombre, setNombre] = useState("");
  const [pais, setPais] = useState(PAIS_POR_DEFECTO);
  const [numero, setNumero] = useState("");
  const [entrega, setEntrega] = useState<EntregaPedido>("recoger");
  const [direccion, setDireccion] = useState("");
  const [nota, setNota] = useState("");
  const [acepto, setAcepto] = useState(false);
  const [sitio, setSitio] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tocado, setTocado] = useState(false);

  const nombreOk = nombreAltaValido(nombre);
  const telefono = aE164(pais, numero);
  const direccionOk = entrega === "recoger" || direccionValida(direccion);
  const listo = nombreOk && Boolean(telefono) && direccionOk && acepto && (Boolean(token) || !siteKey) && lineas.length > 0;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setTocado(true);
    if (!listo || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/catalogo/${encodeURIComponent(slug)}/pedido`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          pais,
          numero,
          entrega,
          direccion: entrega === "domicilio" ? direccion : "",
          nota,
          items: lineasAItems(lineas),
          acepto: true,
          token,
          sitio,
        }),
      });
      const cuerpo = (await res.json().catch(() => null)) as (Partial<ResultadoPedido> & { error?: string }) | null;
      if (!res.ok || !cuerpo?.codigo) throw new Error(cuerpo?.error ?? "No se pudo enviar el pedido. Intenta de nuevo.");
      onEnviado();
      router.push(`/catalogo/${slug}/pedido/${cuerpo.codigo}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el pedido. Intenta de nuevo.");
      // Un token de Turnstile sirve una sola vez.
      turnstileRef.current?.reset();
      setToken(null);
      setEnviando(false);
    }
  };

  const campo = "h-11 w-full rounded-xl border border-slate-200 px-3 text-base";
  const aviso = (texto: string) => <p className="mt-1 text-xs text-red-600">{texto}</p>;

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Tu nombre</span>
        <input
          value={nombre}
          maxLength={60}
          autoComplete="name"
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Ana López"
          className={campo}
          aria-invalid={tocado && !nombreOk}
        />
        {tocado && !nombreOk && aviso("Escribe tu nombre (de 2 a 60 letras).")}
      </label>

      <div className="text-sm">
        <span className="mb-1 block font-medium">Tu celular</span>
        <TelefonoInput
          id="pedido-celular"
          pais={pais}
          numero={numero}
          onPaisChange={setPais}
          onNumeroChange={setNumero}
          invalido={tocado && !telefono}
          placeholder="10 dígitos"
          required
        />
        {tocado && !telefono && aviso("Revisa tu número de celular.")}
      </div>

      <fieldset className="text-sm">
        <legend className="mb-1 font-medium">¿Cómo lo quieres?</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["recoger", "Paso por él"],
              ["domicilio", "A domicilio"],
            ] as const
          ).map(([valor, texto]) => (
            <label
              key={valor}
              className={`flex h-11 cursor-pointer items-center justify-center rounded-xl border text-sm font-medium ${
                entrega === valor ? "border-transparent text-white" : "border-slate-200 text-slate-700"
              }`}
              style={entrega === valor ? { backgroundColor: color } : undefined}
            >
              <input
                type="radio"
                name="entrega"
                value={valor}
                checked={entrega === valor}
                onChange={() => setEntrega(valor)}
                className="sr-only"
              />
              {texto}
            </label>
          ))}
        </div>
      </fieldset>

      {entrega === "domicilio" && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Dirección de entrega</span>
          <textarea
            value={direccion}
            maxLength={DIRECCION_MAX}
            rows={2}
            autoComplete="street-address"
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="Calle, número, colonia y referencias"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base"
            aria-invalid={tocado && !direccionOk}
          />
          {tocado && !direccionOk && aviso("Escribe tu dirección de entrega.")}
        </label>
      )}

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Nota para el negocio (opcional)</span>
        <textarea
          value={nota}
          maxLength={NOTA_MAX}
          rows={2}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej. sin cebolla, paso después de las 5"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base"
        />
      </label>

      {/* Trampa para bots: fuera de la vista y del teclado; una persona nunca la llena. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="pedido-sitio">Sitio web</label>
        <input id="pedido-sitio" tabIndex={-1} autoComplete="off" value={sitio} onChange={(e) => setSitio(e.target.value)} />
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-slate-600">
        <input
          type="checkbox"
          checked={acepto}
          onChange={(e) => setAcepto(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span>
          Acepto que <span className="font-medium text-slate-900">{negocio}</span> use mi nombre, celular y dirección solo
          para atender este pedido.{" "}
          <a href="/es/aviso-privacidad" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            Aviso de privacidad
          </a>
        </span>
      </label>
      {tocado && !acepto && aviso("Acepta el aviso para enviar tu pedido.")}

      {siteKey && (
        <div className="flex justify-center">
          <Turnstile
            id="cf-turnstile-pedido-catalogo"
            siteKey={siteKey}
            onSuccess={setToken}
            onError={() => setToken(null)}
            onExpire={() => setToken(null)}
            ref={turnstileRef}
          />
        </div>
      )}
      {siteKey && tocado && !token && !enviando && (
        <p className="-mt-2 text-center text-xs text-slate-500">Completa la verificación de arriba para continuar.</p>
      )}

      {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={enviando || (tocado && !listo)}
        style={{ backgroundColor: color }}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold text-white disabled:opacity-60"
      >
        {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Enviar pedido
      </button>
      <p className="text-center text-xs text-slate-500">
        {negocio} te confirma precio y disponibilidad. Podrás seguir tu pedido desde la página que se abre.
      </p>
    </form>
  );
}
