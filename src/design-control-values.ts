import type { DesignSettings } from './types/design';

/** Preserves each setting’s numeric, text, or checkbox representation. */
export function readDesignControlValue(element: HTMLInputElement | HTMLSelectElement, currentValue: DesignSettings[keyof DesignSettings]): string | number | boolean {
  if (element instanceof HTMLInputElement && element.type === 'checkbox') return element.checked;
  return typeof currentValue === 'number' ? Number(element.value) : element.value;
}
