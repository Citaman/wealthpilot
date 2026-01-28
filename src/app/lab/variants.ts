export type LabVariant = {
  id: string;
  name: string;
  path: string;
  nav: string;
  summary: string;
  tags: string[];
};

export const labVariants: LabVariant[] = [
  {
    id: "v1",
    name: "Neo-Brutal Ledger",
    path: "/lab/v1",
    nav: "Top command bar",
    summary: "Hard edges, thick borders, loud primary accents, zero softness.",
    tags: ["brutal", "grid", "bold"],
  },
  {
    id: "v2",
    name: "Swiss Editorial Grid",
    path: "/lab/v2",
    nav: "Vertical margin nav",
    summary: "Editorial hierarchy, hairline rules, restrained color.",
    tags: ["editorial", "minimal", "type"],
  },
  {
    id: "v3",
    name: "Glasswave AI",
    path: "/lab/v3",
    nav: "Bottom dock",
    summary: "Layered glass, aurora glow, AI command lane.",
    tags: ["glass", "aurora", "ai"],
  },
  {
    id: "v4",
    name: "Terminal Finance",
    path: "/lab/v4",
    nav: "Bottom dock",
    summary: "Console-grade density, mono type, system bars.",
    tags: ["terminal", "dense", "mono"],
  },
  {
    id: "v5",
    name: "Bauhaus Blocks",
    path: "/lab/v5",
    nav: "Bottom dock",
    summary: "Geometric panels, primary blocks, strong modularity.",
    tags: ["bauhaus", "blocks", "geometry"],
  },
  {
    id: "v6",
    name: "Kinetic Tape",
    path: "/lab/v6",
    nav: "Ribbon rail",
    summary: "Angled ribbons, high energy, directional flow.",
    tags: ["tape", "dynamic", "labels"],
  },
  {
    id: "v7",
    name: "Monolith Minimal",
    path: "/lab/v7",
    nav: "Right tower",
    summary: "Stark mono, hard edges, command tower.",
    tags: ["monochrome", "strict", "minimal"],
  },
  {
    id: "v8",
    name: "Warm Atelier",
    path: "/lab/v8",
    nav: "Bottom dock",
    summary: "Warm tones, craft texture, humanist type.",
    tags: ["warm", "crafted", "trust"],
  },
  {
    id: "v9",
    name: "Topographic Data",
    path: "/lab/v9",
    nav: "Center command",
    summary: "Contour maps, layered data plates, terrain charts.",
    tags: ["map", "layers", "data"],
  },
  {
    id: "v10",
    name: "Orbital System",
    path: "/lab/v10",
    nav: "Bottom dock",
    summary: "Circular motifs, radial charts, orbit controls.",
    tags: ["orbital", "radial", "future"],
  },
];
