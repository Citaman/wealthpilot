import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const out = fileURLToPath(new URL("../public/references/", import.meta.url));
// Build output only: canonical designs stay in the repository's design directory.
await mkdir(out, { recursive: true });
await cp(path.join(root, "design"), path.join(out, "design"), {
  recursive: true,
  filter: (source) => !source.endsWith(".zip"),
});
await cp(path.join(root, "images_ref"), path.join(out, "images_ref"), {
  recursive: true,
});
await cp(
  path.join(root, "BRIEF_WEALTHPILOT.md"),
  path.join(out, "BRIEF_WEALTHPILOT.md"),
);
const components = JSON.parse(
  await readFile(
    path.join(root, "design/component-sheets-rime-2026-10-02/manifest.json"),
    "utf8",
  ),
);
const pages = JSON.parse(
  await readFile(
    path.join(root, "design/pages-v1-2026-10-02/manifest.json"),
    "utf8",
  ),
);
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const card = (title, src) =>
  '<a href="' +
  escape(src) +
  '"><img loading="lazy" src="' +
  escape(src) +
  '" alt="' +
  escape(title) +
  '"/><strong>' +
  escape(title) +
  "</strong></a>";
const html =
  '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WealthPilot — Références conservées</title><style>body{background:#eee8da;color:#25221d;font:16px/1.6 system-ui;margin:0;padding:35px;max-width:1500px;margin:auto}h1{font-size:42px;line-height:1.1}a{color:inherit}nav{display:flex;gap:20px;flex-wrap:wrap;margin:30px 0}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px}.grid a{border:1px solid;border-radius:15px;overflow:hidden;text-decoration:none;background:#f4eee2}.grid img{width:100%;height:300px;object-fit:contain;display:block}.grid strong{display:block;padding:15px}section{margin:50px 0}p{max-width:850px}</style><a href="/">← Retour à WealthPilot</a><h1>Le projet, en images.</h1><p>Références stockées dans le dépôt. Les images sont des maquettes, pas des calculs financiers validés. Le brief décrit la cible V1 ; le dashboard et l’import constituent la première tranche.</p><nav><a href="BRIEF_WEALTHPILOT.md" download>Brief unique</a><a href="design/component-library-2026-10-02/component-library-specification.md" download>Spécification des composants</a><a href="#pages">14 pages</a><a href="#composants">30 composants</a></nav><section><h2>Direction approuvée</h2><div class="grid">' +
  card(
    "Direction Rime",
    "design/rime-direction-2026-10-02/four-components.png",
  ) +
  '</div></section><section id="pages"><h2>Les 14 pages</h2><p><a href="design/pages-v1-2026-10-02/index.html">Ouvrir la galerie et ses réserves de lecture</a></p><div class="grid">' +
  pages
    .map((p) => card(p.title, "design/pages-v1-2026-10-02/" + p.file))
    .join("") +
  '</div></section><section id="composants"><h2>Les 30 composants</h2><div class="grid">' +
  components.components
    .map((p) =>
      card(
        p.id + " · " + p.title,
        "design/component-sheets-rime-2026-10-02/" + p.image,
      ),
    )
    .join("") +
  "</div></section></html>";
await writeFile(path.join(out, "index.html"), html);
console.log(
  "Références synchronisées : 14 pages, 30 composants, direction, documents et archives de design.",
);
