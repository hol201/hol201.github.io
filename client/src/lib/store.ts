import { create } from "zustand";

interface SettingsState {
  theme: "light" | "dark" | "sepia";
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  setTheme: (theme: "light" | "dark" | "sepia") => void;
  setFontFamily: (font: string) => void;
  setFontSize: (size: number) => void;
  setLineHeight: (height: number) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: "light",
  fontFamily: "Inter, sans-serif",
  fontSize: 18,
  lineHeight: 1.6,
  setTheme: (theme) => set({ theme }),
  setFontFamily: (fontFamily) => set({ fontFamily }),
  setFontSize: (fontSize) => set({ fontSize }),
  setLineHeight: (lineHeight) => set({ lineHeight }),
}));
