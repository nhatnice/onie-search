import { create } from 'zustand';

interface CounterState {
  count: number;
}

export const counterStore = create<CounterState>(() => ({
  count: 0,
}));

export const useCount = () => counterStore((s) => s.count);
