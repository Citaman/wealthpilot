"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { useTheme } from "./theme-context";
import {
  foregroundFor,
  hexToRgbTuple,
  normalizeAccent,
  rgbString,
} from "./accent-utils";

export type AccentPresetId =
  | "coral"
  | "ocean"
  | "sage"
  | "violet"
  | "rose"
  | "graphite";

export interface AccentPreset {
  id: string;
  name: string;
  light: string;
  dark: string;
  hex: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: "coral", name: "Corail", light: "167 52 24", dark: "255 155 126", hex: "#A73418" },
  { id: "ocean", name: "Océan", light: "0 91 156", dark: "117 191 255", hex: "#005B9C" },
  { id: "sage", name: "Sauge", light: "25 107 56", dark: "111 213 138", hex: "#196B38" },
  { id: "violet", name: "Violet", light: "104 66 160", dark: "199 167 255", hex: "#6842A0" },
  { id: "rose", name: "Rose", light: "166 43 77", dark: "255 157 178", hex: "#A62B4D" },
  { id: "graphite", name: "Graphite", light: "75 85 99", dark: "203 213 225", hex: "#4B5563" },
];

const STORAGE_KEY = "accent-preset";
const CUSTOM_STORAGE_KEY = "custom-accent-presets";

type AccentContextValue = {
  presetId: string;
  preset: AccentPreset;
  setPreset: (id: string) => void;
  presets: AccentPreset[];
  addCustomPreset: (name: string, hex: string) => string;
  removeCustomPreset: (id: string) => void;
};

const AccentContext = createContext<AccentContextValue | undefined>(undefined);

function applyAccent(rgb: string) {
  const root = document.documentElement;
  const tuple = rgb.split(" ").map(Number) as [number, number, number];
  root.style.setProperty("--primary", rgb);
  root.style.setProperty("--primary-foreground", rgbString(foregroundFor(tuple)));
  root.style.setProperty("--ring", rgb);
  root.style.setProperty("--chart-1", rgb);
}

export function parseCustomAccentPresets(value: string | null): AccentPreset[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): AccentPreset[] => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as Partial<AccentPreset>;
      if (typeof candidate.id !== "string" || !candidate.id.startsWith("custom-")) return [];
      if (typeof candidate.name !== "string" || typeof candidate.hex !== "string") return [];
      const raw = hexToRgbTuple(candidate.hex);
      if (!raw) return [];
      return [{
        id: candidate.id,
        name: candidate.name.trim().slice(0, 40) || "Personnalisée",
        light: rgbString(normalizeAccent(raw, "light")),
        dark: rgbString(normalizeAccent(raw, "dark")),
        hex: candidate.hex.toUpperCase(),
      }];
    }).slice(0, 12);
  } catch {
    return [];
  }
}

export function AccentProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [allPresets, setAllPresets] = useState<AccentPreset[]>(ACCENT_PRESETS);
  const [presetId, setPresetIdState] = useState("coral");

  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY) || "coral";
    const savedCustom = localStorage.getItem(CUSTOM_STORAGE_KEY);

    const customPresets = parseCustomAccentPresets(savedCustom);
    const available = [...ACCENT_PRESETS, ...customPresets];
    const selectedId = available.some((preset) => preset.id === savedId) ? savedId : "coral";
    setAllPresets(available);
    setPresetIdState(selectedId);
    if (selectedId !== savedId) localStorage.setItem(STORAGE_KEY, selectedId);
  }, []);

  useEffect(() => {
    const preset =
      allPresets.find((p) => p.id === presetId) || ACCENT_PRESETS[0];
    const rgb = resolvedTheme === "dark" ? preset.dark : preset.light;
    applyAccent(rgb);
  }, [presetId, resolvedTheme, allPresets]);

  const setPreset = useCallback((id: string) => {
    setPresetIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const addCustomPreset = useCallback((name: string, hex: string): string => {
    const id = `custom-${Date.now()}`;
    const raw = hexToRgbTuple(hex) ?? [167, 52, 24];
    const light = normalizeAccent(raw, "light");
    const dark = normalizeAccent(raw, "dark");
    const newPreset: AccentPreset = {
      id,
      name,
      light: rgbString(light),
      dark: rgbString(dark),
      hex,
    };

    setAllPresets((prev) => {
      const updated = [...prev, newPreset];
      const customOnly = updated.filter((p) => p.id.startsWith("custom-"));
      localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(customOnly));
      return updated;
    });

    return id;
  }, []);

  const removeCustomPreset = useCallback(
    (id: string) => {
      setAllPresets((prev) => {
        const updated = prev.filter((p) => p.id !== id);
        const customOnly = updated.filter((p) => p.id.startsWith("custom-"));
        localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(customOnly));
        return updated;
      });
      if (presetId === id) {
        setPreset("coral");
      }
    },
    [presetId, setPreset]
  );

  const currentPreset =
    allPresets.find((p) => p.id === presetId) || ACCENT_PRESETS[0];

  const value = useMemo<AccentContextValue>(
    () => ({
      presetId,
      preset: currentPreset,
      setPreset,
      presets: allPresets,
      addCustomPreset,
      removeCustomPreset,
    }),
    [
      presetId,
      currentPreset,
      setPreset,
      allPresets,
      addCustomPreset,
      removeCustomPreset,
    ]
  );

  return (
    <AccentContext.Provider value={value}>{children}</AccentContext.Provider>
  );
}

export function useAccent() {
  const ctx = useContext(AccentContext);
  if (!ctx) {
    throw new Error("useAccent must be used within AccentProvider");
  }
  return ctx;
}
