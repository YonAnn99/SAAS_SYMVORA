import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));

import { BotonActualizar } from "@/components/ui/boton-actualizar";

afterEach(() => {
  vi.useRealTimers();
  toastError.mockReset();
});

describe("BotonActualizar", () => {
  it("un doble clic dispara una sola carga y se desactiva mientras corre", async () => {
    vi.useFakeTimers();
    let terminar: () => void = () => undefined;
    const onActualizar = vi.fn(() => new Promise<void>((r) => (terminar = r)));
    render(<BotonActualizar onActualizar={onActualizar} />);
    const boton = screen.getByRole("button", { name: "Actualizar datos" });

    fireEvent.click(boton);
    fireEvent.click(boton);
    expect(onActualizar).toHaveBeenCalledTimes(1);
    expect(boton).toHaveProperty("disabled", true);

    await act(async () => {
      terminar();
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(boton).toHaveProperty("disabled", false);
  });

  it("si la carga falla, avisa y se vuelve a poder usar", async () => {
    vi.useFakeTimers();
    render(<BotonActualizar onActualizar={() => Promise.reject(new Error("red"))} />);
    const boton = screen.getByRole("button", { name: "Actualizar datos" });
    await act(async () => {
      fireEvent.click(boton);
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(toastError).toHaveBeenCalledWith("No se pudieron actualizar los datos");
    expect(boton).toHaveProperty("disabled", false);
  });
});
