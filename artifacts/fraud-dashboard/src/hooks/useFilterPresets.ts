import { useState, useCallback } from "react";

export interface FilterPreset {
  id: string;
  name: string;
  filters: Record<string, string>;
  createdAt: string;
}

export function useFilterPresets(namespace: string) {
  const storageKey = `fraud_filter_presets_${namespace}`;

  function load(): FilterPreset[] {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    } catch {
      return [];
    }
  }

  const [presets, setPresets] = useState<FilterPreset[]>(load);

  const savePreset = useCallback((name: string, filters: Record<string, string>) => {
    const next = [
      ...load().filter((p) => p.name !== name),
      { id: crypto.randomUUID(), name, filters, createdAt: new Date().toISOString() },
    ];
    localStorage.setItem(storageKey, JSON.stringify(next));
    setPresets(next);
  }, [storageKey]);

  const deletePreset = useCallback((id: string) => {
    const next = load().filter((p) => p.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(next));
    setPresets(next);
  }, [storageKey]);

  return { presets, savePreset, deletePreset };
}
