/**
 * Theme-aware color palette system.
 * 9 paired colors — each has a dark-mode and light-mode variant.
 * Custom picker colors stay unchanged across themes.
 */

export const COLOR_PAIRS = [
  { id: 0, dark: '#22c55e', light: '#059669', name: 'Green' },
  { id: 1, dark: '#3b82f6', light: '#1d4ed8', name: 'Blue' },
  { id: 2, dark: '#a855f7', light: '#7c3aed', name: 'Purple' },
  { id: 3, dark: '#f472b6', light: '#be185d', name: 'Pink' },
  { id: 4, dark: '#fbbf24', light: '#b45309', name: 'Yellow' },
  { id: 5, dark: '#ef4444', light: '#b91c1c', name: 'Red' },
  { id: 6, dark: '#2dd4bf', light: '#0d9488', name: 'Teal' },
  { id: 7, dark: '#6366f1', light: '#4338ca', name: 'Indigo' },
  { id: 8, dark: '#fb7185', light: '#9f1239', name: 'Rose' },
];

export const DARK_COLORS = COLOR_PAIRS.map(p => p.dark);
export const LIGHT_COLORS = COLOR_PAIRS.map(p => p.light);
export const ALL_STANDARD_COLORS = [...DARK_COLORS, ...LIGHT_COLORS];

export function isStandardColor(color) {
  return ALL_STANDARD_COLORS.includes(color);
}

export function getColorPairIndex(color) {
  const pair = COLOR_PAIRS.find(p => p.dark === color || p.light === color);
  return pair ? pair.id : -1;
}

export function getDisplayColor(storedColor, theme) {
  if (!storedColor) return theme === 'dark' ? DARK_COLORS[0] : LIGHT_COLORS[0];
  const idx = getColorPairIndex(storedColor);
  if (idx === -1) return storedColor;
  const pair = COLOR_PAIRS[idx];
  return theme === 'dark' ? pair.dark : pair.light;
}

export function getThemeColors(theme) {
  return theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
}

export function getDefaultColor(theme) {
  return theme === 'dark' ? DARK_COLORS[0] : LIGHT_COLORS[0];
}

export function normalizeColorForStorage(color) {
  const idx = getColorPairIndex(color);
  return idx === -1 ? color : COLOR_PAIRS[idx].dark;
}

export function areColorsEquivalent(a, b) {
  if (a === b) return true;
  const i = getColorPairIndex(a);
  const j = getColorPairIndex(b);
  return i !== -1 && i === j;
}
