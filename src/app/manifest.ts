import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "WealthPilot",
    short_name: "WealthPilot",
    description: "Pilotage financier du foyer, local et confidentiel.",
    start_url: "/?launch=installed",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#a73418",
    lang: "fr",
    orientation: "any",
    categories: ["finance", "productivity"],
    shortcuts: [
      { name: "Importer un relevé", short_name: "Importer", url: "/import?launch=shortcut" },
      { name: "Plan 13 semaines", short_name: "Plan", url: "/plan?launch=shortcut" },
      { name: "Transactions", short_name: "Transactions", url: "/transactions?launch=shortcut" },
    ],
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/icons/maskable-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
