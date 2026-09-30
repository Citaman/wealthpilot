import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Link from "next/link";
import { Button } from "../button";

describe("Button", () => {
  it("conserve un enfant unique avec asChild", () => {
    const html = renderToStaticMarkup(<Button asChild><Link href="/goals">Objectifs</Link></Button>);
    expect(html).toContain('href="/goals"');
    expect(html).toContain("Objectifs");
    expect(html).not.toContain("<button");
  });

  it("annonce et désactive le chargement", () => {
    const html = renderToStaticMarkup(<Button loading>Enregistrer</Button>);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("disabled");
  });
});
