import Link from "next/link";

export default function RootNotFound() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full text-center flex flex-col items-center gap-6">
        <span
          className="text-[clamp(7rem,18vw,11rem)] leading-none font-bold tracking-tight text-black"
          aria-hidden="true"
        >
          404
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-black">
          Página no encontrada
        </h1>
        <p className="text-base sm:text-lg text-neutral-500 max-w-md leading-relaxed">
          La ruta solicitada no existe. Regresa al inicio para continuar navegando.
        </p>
        <Link
          href="/es"
          className="inline-flex items-center justify-center gap-2 bg-black text-white font-semibold px-6 py-3 rounded-lg hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
