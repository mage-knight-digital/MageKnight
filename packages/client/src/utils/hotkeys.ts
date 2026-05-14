export function isEditableHotkeyTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable);
}

export function matchesHotkey(
  event: KeyboardEvent,
  keys: readonly string[],
  codes: readonly string[] = [],
): boolean {
  const key = event.key.toLowerCase();
  const code = event.code;

  return keys.includes(key) || codes.includes(code);
}
