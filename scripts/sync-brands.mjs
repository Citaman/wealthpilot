import * as icons from "simple-icons";
import { mkdir, writeFile } from "node:fs/promises";
const out = new URL("../public/brands/", import.meta.url);
await mkdir(out, { recursive: true });
const brands = Object.values(icons).filter((icon) => icon.slug && icon.path);
await Promise.all(
  brands.map((icon) =>
    writeFile(
      new URL(icon.slug + ".svg", out),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#${icon.hex}"><path d="${icon.path}"/></svg>`,
    ),
  ),
);
await writeFile(
  new URL("../src/brands.generated.json", import.meta.url),
  JSON.stringify(brands.map(({ slug, title, hex }) => ({ slug, title, hex }))),
);
console.log(`${brands.length} logos de marques disponibles localement.`);
