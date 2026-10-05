import fs from "node:fs/promises";
const root = new URL("../test-results/merchant-research/", import.meta.url);
const rows = JSON.parse(
  await fs.readFile(new URL("../../src/merchant-assets.json", root), "utf8"),
);
await fs.writeFile(
  new URL("index.html", root),
  `<!doctype html><meta charset="utf-8"><title>Public brand asset review</title><style>body{font:16px system-ui;background:#eee8da;padding:24px}main{display:grid;grid-template-columns:repeat(8,1fr);gap:12px}article{background:white;padding:18px;text-align:center}img{width:64px;height:64px;object-fit:contain}p{margin:8px 0}</style><h1>Public brand assets — review before inclusion</h1><main>${rows
    .filter((r) => r.src)
    .map(
      (r) =>
        `<article><img src="${r.src}" alt="${r.slug}"><p>${r.title}</p><small>${r.slug}</small></article>`,
    )
    .join("")}</main>`,
);
