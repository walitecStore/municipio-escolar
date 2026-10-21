import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Municipio Escolar · Gestión electoral",
    short_name: "Municipio Escolar",
    description: "Acceso institucional a elecciones escolares",
    id: "/",
    start_url: "/sistema",
    scope: "/",
    display: "standalone",
    background_color: "#f5f8fc",
    theme_color: "#17375e",
    lang: "es-PE",
    icons: [
      {
        src: "/icons/app-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/app-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
