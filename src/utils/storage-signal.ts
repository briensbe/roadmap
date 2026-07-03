import { signal, WritableSignal, effect } from '@angular/core';

/**
 * Creates a WritableSignal that syncs with localStorage.
 *
 * @param key The localStorage key to use.
 * @param initialValue The initial value to use if no value is found in localStorage.
 * @returns A WritableSignal initialized with the stored value or initialValue.
 */
export function storageSignal<T>(key: string, initialValue: T): WritableSignal<T> {
  // Read from localStorage on initialization
  const storedValue = localStorage.getItem(key);
  let value: T = initialValue;

  if (storedValue) {
    try {
      value = JSON.parse(storedValue);
    } catch (e) {
      console.warn(`Error parsing localStorage key "${key}":`, e);
      // Fallback to initialValue, but we might want to clear the invalid key?
      // For now, just ignoring the error and using initialValue is safe.
    }
  }

  const s = signal<T>(value);

  // Sync to localStorage whenever the signal changes
  effect(() => {
    const v = s();
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch (e) {
      console.error(`Error saving to localStorage key "${key}":`, e);
    }
  });

  return s;
}
