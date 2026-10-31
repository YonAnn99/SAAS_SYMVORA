import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SYMVORA",
    short_name: "SYMVORA",
    description:
      "Punto de venta, inventario y finanzas para PyMEs mexicanas.",
    // `id` fijo: es la identidad de la PWA instalada (y de la app de Android,
    // una TWA). Es igual al que el navegador calculaba con el start_url, asi
    // que las instalaciones que ya existen no cambian.
    id: "/es/dashboard",
    start_url: "/es/dashboard",
    display: "standalone",
    background_color: "#1E3A8A",
    theme_color: "#0A0A0A",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
