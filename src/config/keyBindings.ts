export type KeyAction = 'forward' | 'backward' | 'left' | 'right' | 'jump' | 'sprint' | 'menu';

export interface KeyBinding {
  action: KeyAction;
  key: string;
  label: string;
}

export const defaultKeyBindings: KeyBinding[] = [
  { action: 'forward', key: 'KeyW', label: 'W' },
  { action: 'backward', key: 'KeyS', label: 'S' },
  { action: 'left', key: 'KeyA', label: 'A' },
  { action: 'right', key: 'KeyD', label: 'D' },
  { action: 'jump', key: 'Space', label: 'Space' },
  { action: 'sprint', key: 'ShiftLeft', label: 'Shift' },
  { action: 'menu', key: 'Escape', label: 'Esc' }
];

/**
 * Get the key code for a specific action from the key bindings
 */
export function getKeyForAction(bindings: KeyBinding[], action: KeyAction): string {
  const binding = bindings.find(b => b.action === action);
  return binding ? binding.key : '';
}

/**
 * Get the label for a specific action from the key bindings
 */
export function getLabelForAction(bindings: KeyBinding[], action: KeyAction): string {
  const binding = bindings.find(b => b.action === action);
  return binding ? binding.label : '';
}

/**
 * Save key bindings to local storage
 */
export function saveKeyBindings(bindings: KeyBinding[]): void {
  localStorage.setItem('keyBindings', JSON.stringify(bindings));
}

/**
 * Load key bindings from local storage or return defaults
 */
export function loadKeyBindings(): KeyBinding[] {
  const savedBindings = localStorage.getItem('keyBindings');
  return savedBindings ? JSON.parse(savedBindings) : defaultKeyBindings;
}

/**
 * Update a specific key binding
 */
export function updateKeyBinding(
  bindings: KeyBinding[],
  action: KeyAction,
  newKey: string,
  newLabel: string
): KeyBinding[] {
  return bindings.map(binding => {
    if (binding.action === action) {
      return { ...binding, key: newKey, label: newLabel };
    }
    return binding;
  });
}
