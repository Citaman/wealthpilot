"use client";

import { useMemo, useState } from "react";
import { Check, Monitor, Moon, Plus, Sun, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useTheme, type ThemeMode } from "@/contexts/theme-context";
import { ACCENT_PRESETS, useAccent } from "@/contexts/accent-context";
import { contrastRatio, foregroundFor, hexToRgbTuple, normalizeAccent } from "@/contexts/accent-utils";
import { cn } from "@/lib/utils";

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const { presetId, presets, setPreset, addCustomPreset, removeCustomPreset } = useAccent();
  const [customColor, setCustomColor] = useState("#A73418");
  const [customOpen, setCustomOpen] = useState(false);
  const rawColor = useMemo(() => hexToRgbTuple(customColor), [customColor]);
  const normalizedLight = rawColor ? normalizeAccent(rawColor, "light") : null;
  const normalizedDark = rawColor ? normalizeAccent(rawColor, "dark") : null;
  const lightRatio = normalizedLight ? contrastRatio(normalizedLight, [255, 255, 255]) : 0;
  const darkRatio = normalizedDark ? contrastRatio(normalizedDark, [12, 18, 28]) : 0;
  const builtInIds = new Set(ACCENT_PRESETS.map((preset) => preset.id));

  const addCustom = () => {
    if (!rawColor) return;
    const id = addCustomPreset("Personnalisée", customColor);
    setPreset(id);
    setCustomOpen(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apparence de l’application</CardTitle>
        <CardDescription>Les choix sont synchronisés avec le thème du shell et conservés sur cet appareil.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <fieldset>
          <legend className="font-semibold">Thème</legend>
          <p className="mt-1 text-sm text-muted-foreground">Le mode système suit automatiquement les changements de votre appareil.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {([
              { value: "light", label: "Clair", icon: Sun },
              { value: "dark", label: "Sombre", icon: Moon },
              { value: "system", label: "Système", icon: Monitor },
            ] as const).map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" onClick={() => setTheme(value as ThemeMode)} aria-pressed={theme === value} className={cn("flex min-h-12 items-center gap-3 rounded-xl border px-4 text-left font-medium", theme === value ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-accent hover:text-accent-foreground")}>
                <Icon className="h-5 w-5" />{label}{theme === value ? <Check className="ml-auto h-4 w-4" /> : null}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-semibold">Couleur d’accent</legend>
          <p className="mt-1 text-sm text-muted-foreground">Chaque palette adapte automatiquement sa couleur de texte pour respecter le contraste AA.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {presets.map((preset) => {
              const selected = presetId === preset.id;
              const custom = !builtInIds.has(preset.id as never);
              const rgb = preset.light.split(" ").map(Number) as [number, number, number];
              const foreground = foregroundFor(rgb);
              return <div key={preset.id} className={cn("relative flex min-h-12 items-center rounded-xl border", selected ? "border-primary ring-2 ring-primary/25" : "border-input")}><button type="button" onClick={() => setPreset(preset.id)} aria-pressed={selected} aria-label={`Accent ${preset.name}`} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 text-left"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border" style={{ backgroundColor: `rgb(${preset.light.replaceAll(" ", ",")})`, color: `rgb(${foreground.join(",")})` }}>{selected ? <Check className="h-4 w-4" /> : null}</span><span className="truncate text-sm font-medium">{preset.name}</span></button>{custom ? <Button type="button" variant="ghost" size="icon" className="mr-1" aria-label={`Supprimer la couleur ${preset.name}`} onClick={() => removeCustomPreset(preset.id)}><Trash2 className="h-4 w-4" /></Button> : null}</div>;
            })}
          </div>

          <Button type="button" variant="outline" className="mt-3" onClick={() => setCustomOpen((open) => !open)} aria-expanded={customOpen}><Plus className="mr-2 h-4 w-4" />Ajouter une couleur</Button>
          {customOpen ? <div className="mt-3 rounded-xl border bg-muted/45 p-4"><Label htmlFor="custom-accent">Couleur personnalisée</Label><div className="mt-2 flex flex-wrap items-center gap-3"><input id="custom-accent" type="color" value={customColor} onChange={(event) => setCustomColor(event.target.value)} className="h-11 w-16 cursor-pointer rounded-lg border bg-card p-1" /><code className="rounded bg-card px-2 py-1 text-sm">{customColor.toUpperCase()}</code><Button onClick={addCustom} disabled={!rawColor}>Ajouter</Button></div><p className="mt-3 text-sm text-muted-foreground">Contraste ajusté : {lightRatio.toFixed(1)}:1 en clair · {darkRatio.toFixed(1)}:1 en sombre. La teinte peut être assombrie ou éclaircie automatiquement.</p></div> : null}
        </fieldset>

        <div className="rounded-xl border bg-background p-4" aria-label="Aperçu des composants">
          <p className="font-semibold">Aperçu</p><p className="mt-1 text-sm text-muted-foreground">Boutons, liens, focus et graphiques utilisent la même palette contrôlée.</p>
          <div className="mt-3 flex flex-wrap gap-2"><Button>Action principale</Button><Button variant="outline">Action secondaire</Button><span className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Lien accessible</span></div>
        </div>
      </CardContent>
    </Card>
  );
}
