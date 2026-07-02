import { useState, useEffect } from "react";

const STORAGE_KEY = "prism-editor-swatches:v1";

function loadSwatches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveSwatches(colors: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
}

export function useSwatches(brushColor: string) {
  const [swatches, setSwatches] = useState<string[]>(loadSwatches);

  useEffect(() => {
    saveSwatches(swatches);
  }, [swatches]);

  const addSwatch = () => {
    if (!swatches.includes(brushColor)) {
      setSwatches((prev) => [...prev, brushColor]);
    }
  };

  const removeSwatch = (color: string) => {
    setSwatches((prev) => prev.filter((c) => c !== color));
  };

  return { swatches, addSwatch, removeSwatch };
}
