/** True when the keyboard focus is in something you type into, so single-key shortcuts must stay out of the way. */
export function isTyping(node: EventTarget | null): boolean {
  const n = node as HTMLElement | null;
  if (!n || !n.tagName) return false;
  if (n.isContentEditable || n.tagName === 'TEXTAREA' || n.tagName === 'SELECT') return true;
  return n.tagName === 'INPUT' && !['radio', 'checkbox', 'button'].includes((n as HTMLInputElement).type);
}

/** The modifier key shown in the hint bar. */
export const MOD = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '') ? '⌘' : 'Ctrl';
