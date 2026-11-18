import type { MetadataRoute } from "next";
import { ROUTES } from "@/lib/constants/routes";


export default function manifest(): MetadataRoute.Manifest {
  return {
    id: ROUTES.home,
    name: "Projekt",
    short_name: "Projekt",
    description: "Dein Zugang zu Projekt.",
    lang: "de",
    start_url: ROUTES.home,
    scope: ROUTES.home,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#171717",
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
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
