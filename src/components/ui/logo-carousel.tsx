// Server component a proposito: la marquesina es 100% CSS (@keyframes
// infinite-scroll), sin estado, efectos ni handlers. No hay razon para enviar
// este componente al bundle del cliente.
import React from "react";
import Image from "next/image";

const logos = [
  { src: "/enterprises/ghost-logo.webp", alt: "Ghost" },
  { src: "/enterprises/logo_acrylitec.webp", alt: "Acrylitec Acrílicos" },
  { src: "/enterprises/logo.webp", alt: "Gecotay Mobiliario e Insumos" },
];

export default function LogoCarousel() {
  // 6 copias: cada mitad (3 copias, ~1,600 px) supera el ancho maximo del
  // contenedor (max-w-7xl), asi el loop translateX(-50%) nunca deja espacio
  // vacio y el reinicio es invisible. Antes eran 8 (24 imagenes para 3 logos).
  const extendedLogos = Array.from({ length: 6 }, () => logos).flat();

  return (
    <section className="py-10 sm:py-14 overflow-hidden relative">

      <style>{`
        @keyframes infinite-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-infinite-scroll {
          animation: infinite-scroll 40s linear infinite;
          width: max-content;
        }
        .animate-infinite-scroll:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-infinite-scroll {
            animation: none;
          }
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <p className="text-center text-xs sm:text-sm font-semibold tracking-wider text-zinc-500 dark:text-zinc-500 uppercase mb-6 sm:mb-8">
          Equipos que construyen el futuro con SYMVORA
        </p>

        <div className="relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
          <div className="flex animate-infinite-scroll items-center gap-8 sm:gap-10">
            {extendedLogos.map((logo, index) => (
              // Solo la primera tanda se anuncia: las copias son decoracion del
              // loop y un lector de pantalla leeria 18 logos en vez de 3.
              <div
                key={index}
                className="flex items-center justify-center shrink-0"
                aria-hidden={index >= logos.length ? true : undefined}
              >
                <Image
                  src={logo.src}
                  alt={index >= logos.length ? "" : logo.alt}
                  width={140}
                  height={40}
                  className="object-contain h-6 sm:h-8 w-auto brightness-0 dark:invert opacity-40 hover:opacity-100 transition-opacity duration-300"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
