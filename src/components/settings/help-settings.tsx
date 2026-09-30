"use client";

import { HelpCircle, FileText, Database, Shield } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function HelpSettings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Aide et documentation
          </CardTitle>
          <CardDescription>
            Comprendre la protection de vos données et les fonctions essentielles de WealthPilot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="flex gap-2">
                <Database className="h-4 w-4 text-primary" />
                Où mes données sont-elles stockées ?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p>
                  WealthPilot fonctionne en <strong>local-first</strong>. Vos transactions, comptes et réglages
                  sont stockés dans une base <strong>dans ce navigateur</strong> (IndexedDB).
                </p>
                <p className="mt-2">
                  Aucun serveur distant ne reçoit ces données. En revanche,
                  <strong> effacer les données du navigateur efface aussi vos données financières</strong>, sauf si vous disposez d’une sauvegarde.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="flex gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Comment fonctionnent les sauvegardes ?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p>
                  Vous pouvez créer un <strong>fichier de sauvegarde (.json)</strong> depuis la section <em>Données</em>.
                  Il contient une copie complète de la base locale.
                </p>
                <p className="mt-2">
                  <strong>Conseil :</strong> téléchargez une sauvegarde chaque mois ou après une modification importante,
                  puis conservez-la dans un emplacement sûr (espace chiffré, disque externe ou clé USB).
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger className="flex gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Comment transférer les données vers un nouvel appareil ?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Sur l’ancien appareil, ouvrez Réglages &gt; Données.</li>
                  <li>Choisissez <strong>Exporter une sauvegarde</strong>.</li>
                  <li>Transférez le fichier téléchargé vers le nouvel appareil.</li>
                  <li>Sur le nouvel appareil, ouvrez WealthPilot &gt; Réglages &gt; Données.</li>
                  <li>Choisissez <strong>Importer une sauvegarde</strong>, puis sélectionnez le fichier.</li>
                  <li>Choisissez <strong>Tout remplacer</strong> pour retrouver exactement l’état sauvegardé.</li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger>Quelle différence entre remplacer et fusionner ?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>Tout remplacer :</strong> efface les données locales actuelles et restaure la sauvegarde à l’identique.
                    C’est le choix recommandé pour un nouvel appareil ou une restauration complète.
                  </li>
                  <li>
                    <strong>Fusionner (avancé) :</strong> conserve les données actuelles et y ajoute celles de la sauvegarde.
                    Cette option peut créer des doublons si les deux sources se recoupent.
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
