import { describe, expect, it } from "vitest";
import { cleanLabel } from "./labels";

describe("cleanLabel", () => {
  it("turns bank wording into a short, readable name", () => {
    const cases: [string[], string][] = [
      [
        [
          "PRELEVEMENT EUROPEEN 6523028610 DE: BANQUE FRANCAISE MUTUALISTE ID: FR18ZZZ223174 MOTIF: 00019999BOBOCREO",
        ],
        "Crédit auto BFM",
      ],
      [
        ["VIR RECU 9627163734231 DE: MR ANTHONNY OLIME MOTIF: Voiture"],
        "Virement d’Anthonny Olime · Voiture",
      ],
      [
        ["ARRETE 01.07/30.09 MINIMUM FORFAITAIRE NOMBRE JOURS DEBITEURS : 78"],
        "Frais de découvert",
      ],
      [
        [
          "000001 VIR INSTANTANE EMIS LOGITEL POUR: Orpi Agence nouallet Gestion 05 02 BQ BRED CPT 00152580636",
        ],
        "Virement vers Orpi Agence Nouallet Gestion",
      ],
      [
        ["CARTE X0949 23/09 MCDONALDS 113 110626703216438IOPD"],
        "Mcdonalds 113",
      ],
      [["Loyer ORPI", "000001 VIR INSTANT"], "Loyer ORPI"],
      [
        ["VIR RECU 9611939340518 DE: MME MIRANE OLIME"],
        "Virement de Mirane Olime",
      ],
      [
        [
          "Prelevement Europe",
          "PRELEVEMENT EUROPEEN 8408135664 POUR CPTE DE:DGFIP IMPOT",
        ],
        "Impôt sur le revenu",
      ],
    ];
    for (const [input, expected] of cases)
      expect(cleanLabel(...input)).toBe(expected);
  });
});
