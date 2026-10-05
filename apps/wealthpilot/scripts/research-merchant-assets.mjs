// Maintainer-only public-brand research. Never accepts transaction rows or sends bank labels.
// Downloads only icons explicitly linked from a public brand page; review before merging.
import fs from "node:fs/promises";
const candidates = [
  ["kiabi", "Kiabi", "https://www.kiabi.com/"],
  ["chaussea", "Chaussea", "https://www.chaussea.com/fr/"],
  ["maif", "MAIF", "https://www.maif.fr/"],
  ["cardif", "Cardif", "https://www.cardif.fr/"],
  ["idfm", "Île-de-France Mobilités", "https://www.iledefrance-mobilites.fr/"],
  ["edf", "EDF", "https://www.edf.fr/"],
  ["paul", "Paul", "https://www.paul.fr/"],
  ["primark", "Primark", "https://www.primark.com/fr-fr"],
  ["caf", "CAF", "https://www.caf.fr/"],
  ["orpi", "ORPI", "https://www.orpi.com/"],
  ["veolia", "Veolia", "https://www.veolia.fr/"],
  ["fitnesspark", "Fitness Park", "https://www.fitnesspark.fr/"],
  ["pathe", "Pathé", "https://www.pathe.fr/"],
  ["sanef", "SANEF", "https://www.sanef.com/"],
  ["qare", "Qare", "https://www.qare.fr/"],
  ["totalenergies", "TotalEnergies", "https://totalenergies.com/"],
  ["selecta", "Selecta", "https://www.selecta.com/fr/fr"],
  ["stradivarius", "Stradivarius", "https://www.stradivarius.com/fr/"],
  ["quick", "Quick", "https://www.quick.fr/"],
  ["ivs", "IVS France", "https://www.ivsfrance.com/"],
  ["laposte", "La Poste", "https://www.laposte.fr/"],
  ["effia", "Effia", "https://www.effia.com/"],
  ["ratp", "RATP", "https://www.ratp.fr/"],
  ["normal", "NORMAL", "https://www.normal.fr/"],
  ["transdev", "Transdev", "https://www.transdev.com/"],
  ["intersport", "Intersport", "https://www.intersport.fr/"],
  ["naumy", "Naumy", "https://www.naumy.com/"],
  ["smythstoys", "Smyths Toys", "https://www.smythstoys.com/fr/fr-fr"],
  ["autobacs", "Autobacs", "https://www.autobacs.fr/"],
  ["5asec", "5àsec", "https://www.5asec.fr/"],
  ["deichmann", "Deichmann", "https://www.deichmann.com/fr-fr/"],
  ["avia", "Avia", "https://www.avia-france.fr/"],
  ["esso", "Esso", "https://www.esso.fr/"],
  ["action", "Action", "https://www.action.com/fr-fr/"],
  ["phantasialand", "Phantasialand", "https://www.phantasialand.de/fr/"],
  ["maty", "Maty", "https://www.maty.com/"],
  ["joeandthejuice", "Joe & The Juice", "https://www.joejuice.com/"],
  ["jdsports", "JD Sports", "https://www.jdsports.fr/"],
  ["centerparcs", "Center Parcs", "https://www.centerparcs.fr/"],
  ["hyatt", "Hyatt", "https://www.hyatt.com/"],
  ["maxicoffee", "MaxiCoffee", "https://www.maxicoffee.com/"],
  ["decathlon", "Decathlon", "https://www.decathlon.fr/"],
  ["flunch", "Flunch", "https://www.flunch.fr/"],
  ["besson", "Besson Chaussures", "https://www.besson-chaussures.com/"],
  ["micromania", "Micromania", "https://www.micromania.fr/"],
  ["calzedonia", "Calzedonia", "https://www.calzedonia.com/fr/"],
  ["rituals", "Rituals", "https://www.rituals.com/fr-fr/"],
  ["yvesrocher", "Yves Rocher", "https://www.yves-rocher.fr/"],
  ["lunettespourtous", "Lunettes Pour Tous", "https://lunettespourtous.com/"],
  ["gifi", "GiFi", "https://www.gifi.fr/"],
  ["temu", "Temu", "https://www.temu.com/"],
  ["shein", "SHEIN", "https://fr.shein.com/"],
  ["moviepark", "Movie Park Germany", "https://www.movieparkgermany.de/"],
  ["tezenis", "Tezenis", "https://www.tezenis.com/fr/"],
  ["buffalogrill", "Buffalo Grill", "https://www.buffalo-grill.fr/"],
  ["miniso", "MINISO", "https://www.miniso.com/"],
  ["hylton", "Hylton", "https://www.hylton.fr/"],
  ["disneyland", "Disneyland Paris", "https://www.disneylandparis.com/fr-fr/"],
];
const wanted = process.argv.slice(2);
const queue = candidates.filter(
  ([id]) => !wanted.length || wanted.includes(id),
);
const root = new URL("../", import.meta.url);
const research = new URL("test-results/merchant-research/", root);
await fs.mkdir(research, { recursive: true });
const results = [];
function attr(tag, key) {
  return tag
    .match(new RegExp(`\\b${key}=["']([^"']+)["']`, "i"))?.[1]
    ?.replaceAll("&amp;", "&");
}
async function inspect([slug, title, website]) {
  try {
    const response = await fetch(website, {
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`page HTTP ${response.status}`);
    const html = await response.text();
    const pageTitle = html
      .match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      ?.trim();
    const links = (html.match(/<link\b[^>]+>/gi) ?? [])
      .map((tag) => ({
        href: attr(tag, "href"),
        rel: attr(tag, "rel"),
        size: attr(tag, "sizes"),
      }))
      .filter(
        (x) =>
          x.href && /(^|\s)(icon|apple-touch-icon)(\s|$)/.test(x.rel ?? ""),
      );
    links.sort(
      (a, b) =>
        (b.rel.includes("apple") ? 500 : parseInt(b.size) || 0) -
        (a.rel.includes("apple") ? 500 : parseInt(a.size) || 0),
    );
    for (const link of links.slice(0, 3)) {
      const url = new URL(link.href, response.url).href;
      if (!url.startsWith("https://")) continue;
      const icon = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!icon.ok) continue;
      const type = icon.headers.get("content-type") ?? "";
      const data = Buffer.from(await icon.arrayBuffer());
      if (
        data.length > 1024 * 1024 ||
        data.length < 50 ||
        !/(image|octet-stream)/.test(type)
      )
        continue;
      const svg = data.toString("utf8");
      if (
        /<svg/i.test(svg) &&
        /(<script|<foreignObject|onload=|javascript:)/i.test(svg)
      )
        continue;
      const ext = /<svg/i.test(svg)
        ? "svg"
        : data[0] === 137
          ? "png"
          : data[0] === 255
            ? "jpg"
            : data.subarray(0, 4).toString() === "RIFF"
              ? "webp"
              : "ico";
      await fs.writeFile(new URL(`${slug}.${ext}`, research), data);
      return {
        slug,
        title,
        hex: "25221D",
        website,
        pageTitle,
        source: url,
        file: `${slug}.${ext}`,
        bytes: data.length,
      };
    }
    return {
      slug,
      title,
      website,
      pageTitle,
      error: "No usable declared icon",
    };
  } catch (e) {
    return { slug, title, website, error: e.message };
  }
}
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const row = await inspect(queue.shift());
      results.push(row);
      console.log(JSON.stringify(row));
    }
  }),
);
await fs.writeFile(
  new URL("candidates.json", research),
  JSON.stringify(results, null, 2),
);
