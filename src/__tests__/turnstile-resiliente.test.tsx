import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ESPERAS_REINTENTO_MS, TurnstileResiliente } from "@/components/auth/turnstile-resiliente";
import es from "@/messages/es.json";
import en from "@/messages/en.json";

interface PropsWidget {
  options: { appearance: string; retry: string; refreshExpired: string };
  onSuccess: (token: string) => void;
  onError: (codigo?: string) => void;
  onExpire: () => void;
}

const mocks = vi.hoisted(() => {
  const estado: { props: unknown } = { props: null };
  return {
    reset: vi.fn(),
    sentry: vi.fn(),
    // Las propiedades con que se pintó el widget la ULTIMA vez (para llamar sus callbacks).
    guardar: (p: unknown) => {
      estado.props = p;
    },
    get props() {
      return estado.props as PropsWidget;
    },
  };
});

vi.mock("@marsidev/react-turnstile", async () => {
  const React = await import("react");
  return {
    Turnstile: React.forwardRef(function TurnstileFalso(p: PropsWidget, ref: React.Ref<{ reset: () => void }>) {
      mocks.guardar(p);
      React.useImperativeHandle(ref, () => ({ reset: mocks.reset }));
      return <div data-testid="widget" data-apariencia={p.options.appearance} />;
    }),
  };
});
vi.mock("@sentry/nextjs", () => ({ captureMessage: mocks.sentry }));

function Formulario({ errorInicial = null, mensajes = es }: { errorInicial?: string | null; mensajes?: typeof es }) {
  const [error, setError] = useState<string | null>(errorInicial);
  const [token, setToken] = useState<string | null>(null);
  return (
    <NextIntlClientProvider locale="es" messages={mensajes}>
      <TurnstileResiliente id="cf-turnstile-login" siteKey="clave" onToken={setToken} setError={setError} />
      <p data-testid="error">{error ?? ""}</p>
      <p data-testid="token">{token ?? ""}</p>
    </NextIntlClientProvider>
  );
}

const fallar = (codigo = "600010") => act(() => mocks.props.onError(codigo));
const pasar = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const error = () => screen.getByTestId("error").textContent;
const apariencia = () => screen.getByTestId("widget").getAttribute("data-apariencia");

beforeEach(() => {
  vi.useFakeTimers();
  mocks.reset.mockClear();
  mocks.sentry.mockClear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Turnstile resiliente del login", () => {
  it("arranca invisible y con los reintentos en nuestras manos", () => {
    render(<Formulario />);
    expect(apariencia()).toBe("interaction-only");
    expect(mocks.props.options.retry).toBe("never");
    expect(mocks.props.options.refreshExpired).toBe("auto");
  });

  it("un token verificado llega al formulario; al vencer, se quita", () => {
    render(<Formulario />);
    act(() => mocks.props.onSuccess("tok-1"));
    expect(screen.getByTestId("token").textContent).toBe("tok-1");
    act(() => mocks.props.onExpire());
    expect(screen.getByTestId("token").textContent).toBe("");
  });

  it("el primer fallo no asusta: reintenta solo, sin aviso rojo", () => {
    render(<Formulario />);
    fallar();
    expect(error()).toBe("");
    expect(screen.getByTestId("token").textContent).toBe("");
    expect(mocks.reset).not.toHaveBeenCalled();
    pasar(ESPERAS_REINTENTO_MS[0]);
    expect(mocks.reset).toHaveBeenCalledTimes(1);
    expect(error()).toBe("");
    expect(apariencia()).toBe("interaction-only");
  });

  it("tras dos reintentos fallidos pasa a visible, avisa con el código y ofrece reintentar", () => {
    render(<Formulario />);
    fallar("300030");
    pasar(ESPERAS_REINTENTO_MS[0]);
    fallar("300030");
    pasar(ESPERAS_REINTENTO_MS[1]);
    expect(mocks.reset).toHaveBeenCalledTimes(2);
    expect(error()).toBe("");
    fallar("300030");
    expect(apariencia()).toBe("always");
    expect(error()).toContain("300030");
    expect(error()).toBe(es.auth.captchaError.replace("{codigo}", "300030"));
    expect(screen.getByRole("button", { name: es.auth.captchaReintentar })).toBeTruthy();
  });

  it("reporta a Sentry el código y el widget, UNA vez por carga aunque falle varias", () => {
    render(<Formulario />);
    fallar("110620");
    pasar(ESPERAS_REINTENTO_MS[0]);
    fallar("110620");
    pasar(ESPERAS_REINTENTO_MS[1]);
    fallar("110620");
    expect(mocks.sentry).toHaveBeenCalledTimes(1);
    const [mensaje, contexto] = mocks.sentry.mock.calls[0];
    expect(mensaje).toBe("Turnstile fallo");
    expect(contexto.tags).toEqual({ turnstile_codigo: "110620", turnstile_widget: "cf-turnstile-login" });
    expect(contexto.extra.navegador).toBeTypeOf("string");
  });

  it("sin código, lo marca como desconocido (nunca un aviso con «undefined»)", () => {
    render(<Formulario />);
    const sinCodigo = () => act(() => mocks.props.onError());
    sinCodigo();
    pasar(ESPERAS_REINTENTO_MS[0]);
    sinCodigo();
    pasar(ESPERAS_REINTENTO_MS[1]);
    sinCodigo();
    expect(error()).toContain("desconocido");
    expect(error()).not.toContain("undefined");
  });

  it("si el widget se recupera, el aviso del captcha se QUITA y llega el token", () => {
    render(<Formulario />);
    fallar();
    pasar(ESPERAS_REINTENTO_MS[0]);
    fallar();
    pasar(ESPERAS_REINTENTO_MS[1]);
    fallar();
    expect(error()).not.toBe("");
    act(() => mocks.props.onSuccess("tok-2"));
    expect(error()).toBe("");
    expect(screen.getByTestId("token").textContent).toBe("tok-2");
    expect(screen.queryByRole("button", { name: es.auth.captchaReintentar })).toBeNull();
  });

  it("al recuperarse NO borra otro error del formulario (p. ej. contraseña incorrecta)", () => {
    function ConOtroError() {
      const [err, setErr] = useState<string | null>(null);
      return (
        <NextIntlClientProvider locale="es" messages={es}>
          <TurnstileResiliente id="cf-turnstile-login" siteKey="k" onToken={() => {}} setError={setErr} />
          <button onClick={() => setErr("Contraseña incorrecta")}>otro</button>
          <p data-testid="error">{err ?? ""}</p>
        </NextIntlClientProvider>
      );
    }
    render(<ConOtroError />);
    fallar();
    pasar(ESPERAS_REINTENTO_MS[0]);
    fallar();
    pasar(ESPERAS_REINTENTO_MS[1]);
    fallar();
    fireEvent.click(screen.getByText("otro"));
    act(() => mocks.props.onSuccess("tok-3"));
    expect(error()).toBe("Contraseña incorrecta");
  });

  it("«Reintentar verificación» quita el aviso, reinicia el widget y vuelve a contar", () => {
    render(<Formulario />);
    fallar();
    pasar(ESPERAS_REINTENTO_MS[0]);
    fallar();
    pasar(ESPERAS_REINTENTO_MS[1]);
    fallar();
    mocks.reset.mockClear();
    fireEvent.click(screen.getByRole("button", { name: es.auth.captchaReintentar }));
    expect(mocks.reset).toHaveBeenCalledTimes(1);
    expect(error()).toBe("");
    // Vuelve a tener sus dos reintentos silenciosos antes de avisar otra vez.
    fallar();
    expect(error()).toBe("");
  });

  it("el aviso también está en inglés, con el código", () => {
    render(<Formulario mensajes={en as unknown as typeof es} />);
    fallar("600010");
    pasar(ESPERAS_REINTENTO_MS[0]);
    fallar("600010");
    pasar(ESPERAS_REINTENTO_MS[1]);
    fallar("600010");
    expect(error()).toBe(en.auth.captchaError.replace("{codigo}", "600010"));
  });

  it("el control que reciben los formularios reinicia el widget", () => {
    let control: { reset: () => void } | null = null;
    render(
      <NextIntlClientProvider locale="es" messages={es}>
        <TurnstileResiliente
          id="x"
          siteKey="k"
          onToken={() => {}}
          setError={() => {}}
          ref={(c) => {
            control = c;
          }}
        />
      </NextIntlClientProvider>
    );
    control!.reset();
    expect(mocks.reset).toHaveBeenCalledTimes(1);
  });
});
