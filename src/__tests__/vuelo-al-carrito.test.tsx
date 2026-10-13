import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { animarAlCarrito, controlDelArco, framesDeArco } from "@/features/pos/vuelo-al-carrito";
import { MobileCartBar } from "@/features/pos/components/mobile-cart-bar";

function traslado(frame: Keyframe): [number, number, number] {
  const m = String(frame.transform).match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\((-?[\d.]+)\)/);
  if (!m) throw new Error(`transform inesperado: ${frame.transform}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

describe("framesDeArco", () => {
  const desde = { x: 100, y: 300 };
  const hasta = { x: 900, y: 320 };
  const frames = framesDeArco(desde, hasta, controlDelArco(desde, hasta, "linea"), 0.2);

  it("sale de la foto y termina en el destino, encogido a la escala final", () => {
    expect(frames[0].offset).toBe(0);
    expect(traslado(frames[0])).toEqual([0, 0, 1]);
    expect(frames.at(-1)?.offset).toBe(1);
    expect(traslado(frames.at(-1)!)).toEqual([800, 20, 0.2]);
  });

  it("hacia la linea sube por encima del origen y del destino (arco)", () => {
    const masAlto = Math.min(...frames.map((f) => traslado(f)[1]));
    expect(masAlto).toBeLessThan(-40);
  });

  it("se levanta al despegar y se desvanece solo al final", () => {
    expect(Math.max(...frames.map((f) => traslado(f)[2]))).toBeGreaterThan(1);
    expect(frames.filter((f) => Number(f.opacity) < 1).every((f) => Number(f.offset) > 0.85)).toBe(true);
    expect(Number(frames.at(-1)?.opacity)).toBeCloseTo(0.5);
  });

  it("hacia la barra da un saltito y cae", () => {
    const abajo = { x: 40, y: 790 };
    const c = controlDelArco(desde, abajo, "barra");
    expect(c.y).toBeLessThan(desde.y);
    expect(c.x).toBeGreaterThan(Math.min(desde.x, abajo.x));
  });
});

describe("MobileCartBar con un vuelo en el aire", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("conserva el conteo hasta que aterriza (o se limpia) y luego lo pone al dia", () => {
    vi.useFakeTimers();
    const { rerender } = render(<MobileCartBar itemCount={2} total={72} onOpen={() => {}} />);
    expect(screen.getByText("2")).toBeTruthy();

    // Una foto de origen medible y con `animate`: jsdom no tiene layout.
    const foto = document.createElement("div");
    foto.appendChild(document.createElement("img"));
    foto.getBoundingClientRect = () => ({ left: 10, top: 10, width: 120, height: 90, right: 130, bottom: 100, x: 10, y: 10, toJSON: () => ({}) }) as DOMRect;
    foto.animate = vi.fn() as unknown as HTMLElement["animate"];
    document.body.appendChild(foto);

    act(() => animarAlCarrito(foto, "p1::general"));
    rerender(<MobileCartBar itemCount={3} total={100} onOpen={() => {}} />);
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("$72.00")).toBeTruthy();
    // La etiqueta accesible nunca miente: ya dice lo real.
    expect(screen.getByRole("button").getAttribute("aria-label")).toContain("3 artículos");

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("$100.00")).toBeTruthy();
    // La copia que volaba ya no esta en la pagina.
    expect(document.querySelectorAll("body > div[aria-hidden='true']").length).toBe(0);
  });

  it("sin vuelos, el conteo va al dia al instante", () => {
    const { rerender } = render(<MobileCartBar itemCount={0} total={0} onOpen={() => {}} />);
    rerender(<MobileCartBar itemCount={1} total={28} onOpen={() => {}} />);
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("$28.00")).toBeTruthy();
  });
});
