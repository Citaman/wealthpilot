import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WealthPilot",
    short_name: "WealthPilot",
    description: "Privacy-first personal finance dashboard that runs fully offline.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b0f19",
    theme_color: "#0ea5e9",
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
    ],
  };
}
