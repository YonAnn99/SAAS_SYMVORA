"use client";

import React from "react";
import Image from "next/image";

const logos = [
  { src: "/enterprises/ghost-logo.webp", alt: "Ghost" },
  { src: "/enterprises/logo_acrylitec.webp", alt: "Acrylitec" },
  { src: "/enterprises/logo.webp", alt: "SYMVORA" },
];

export default function LogoCarousel() {
  const extendedLogos = [...logos, ...logos, ...logos, ...logos, ...logos, ...logos];

  return (
    <section className="py-8 sm:py-12 border-y border-zinc-200 dark:border-zinc-800/50 bg-zinc-50 dark:bg-zinc-950/50 overflow-hidden relative">
      
      <style>{`
        @keyframes infinite-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-infinite-scroll {
          animation: infinite-scroll 25s linear infinite;
          width: max-content;
        }
        .animate-infinite-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <p className="text-center text-xs sm:text-sm font-semibold tracking-wider text-zinc-500 dark:text-zinc-500 uppercase mb-6 sm:mb-8">
          Equipos que construyen el futuro con SYMVORA
        </p>
        
        <div className="relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
          <div className="flex animate-infinite-scroll items-center gap-12 sm:gap-24 pr-12 sm:pr-24">
            {extendedLogos.map((logo, index) => (
              <div key={index} className="flex items-center justify-center shrink-0">
                <Image
                  src={logo.src}
                  alt={logo.alt}
                  width={140}
                  height={40}
                  className="object-contain h-12 sm:h-16 w-auto brightness-0 dark:invert opacity-40 hover:opacity-100 transition-opacity duration-300"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}