/** The part step for an arrow key, or undefined when the key isn't a plain browse arrow. */
export function readBrowseStep(event: {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}): 1 | -1 | undefined {
  // Modified arrows belong to the browser and the OS: Alt+← is Back, Shift+→ extends a selection.
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return undefined;
  }

  return arrowKeySteps[event.key];
}

/** ⌘F or Ctrl+F, or `/` (Shift+7 on some layouts, so Shift is allowed): both move focus to Find. */
export function isFindShortcut(event: {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}): boolean {
  if (event.altKey) {
    return false;
  }

  if (event.metaKey || event.ctrlKey) {
    return !event.shiftKey && event.key.toLowerCase() === 'f';
  }

  return event.key === '/';
}

/** Fields take typed keys, so shortcuts that are plain characters must leave them alone. */
export function isTextField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/**
 * True where arrow keys already mean something: fields, and everything on a plate, whose
 * specimens (sliders, tabs, radio groups, listboxes) own their keys.
 */
export function ownsArrowKeys(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (isTextField(target) ||
      target.closest(
        '.system-plate, [role="slider"], [role="tablist"], [role="radiogroup"], [role="listbox"], [role="menu"]',
      ) !== null)
  );
}

const arrowKeySteps: Partial<Record<string, 1 | -1>> = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
};
