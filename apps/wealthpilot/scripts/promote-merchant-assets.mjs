// Explicitly reviewed public icons; never infer approval from a successful HTTP fetch.
import fs from "node:fs/promises";
const root = new URL("../", import.meta.url);
const candidates = JSON.parse(
  await fs.readFile(
    new URL("test-results/merchant-research/candidates.json", root),
    "utf8",
  ),
);
const extra = JSON.parse(
  await fs.readFile(
    new URL("test-results/merchant-research/extra-candidates.json", root),
    "utf8",
  ),
);
const approved = new Set(
  "maif edf paul caf fitnesspark primark cardif selecta qare totalenergies quick ivs laposte effia orpi pathe transdev normal naumy avia deichmann jdsports phantasialand centerparcs autobacs flunch calzedonia rituals lunettespourtous gifi maxicoffee 5asec buffalogrill miniso tezenis moviepark shein hylton".split(
    " ",
  ),
);
const registry = new URL("src/merchant-assets.json", root);
for (const slug of "kiabi chaussea ratp decathlon action hyatt yvesrocher veolia sogessur idfm intersport".split(
  " ",
))
  approved.add(slug);
candidates.push(...extra);
const brands = JSON.parse(await fs.readFile(registry, "utf8"));
for (const b of candidates.filter((b) => approved.has(b.slug) && b.file)) {
  await fs.copyFile(
    new URL("test-results/merchant-research/" + b.file, root),
    new URL("public/merchant-assets/" + b.file, root),
  );
  const entry = {
    slug: b.slug,
    title: b.title,
    hex: b.hex,
    src: "/merchant-assets/" + b.file,
    source: b.source,
    website: b.website,
    ...(b.verified ? { verification: b.verified } : {}),
  };
  const index = brands.findIndex((x) => x.slug === b.slug);
  if (index < 0) brands.push(entry);
  else brands[index] = entry;
}
await fs.writeFile(registry, JSON.stringify(brands, null, 2) + "\n");
console.log(
  `Registered ${brands.length} reviewed assets. Esso redirect intentionally excluded.`,
);
