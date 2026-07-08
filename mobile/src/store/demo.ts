import { create } from "zustand";

interface DemoState {
  /** True once any request has fallen back to bundled demo data. */
  active: boolean;
  activate: () => void;
  reset: () => void;
}

/** Tracks whether the app is currently showing offline demo data. */
export const useDemoStore = create<DemoState>((set) => ({
  active: false,
  activate: () => set((s) => (s.active ? s : { active: true })),
  reset: () => set({ active: false }),
}));
