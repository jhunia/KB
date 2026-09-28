/* ============================================
   Human-friendly colour names for product swatches.
   Products store colours as hex codes (from the admin colour picker)
   or plain names; shoppers should see "Black", not "#000000".
   ============================================ */

/** Colours offered in the admin product form. Products store the *name* (e.g. "Light Blue"). */
export const PRODUCT_COLORS: Array<{ name: string; hex: string }> = [
  { name: 'Black', hex: '#000000' }, { name: 'White', hex: '#f5f5f5' },
  { name: 'Grey', hex: '#808080' }, { name: 'Navy Blue', hex: '#000080' },
  { name: 'Red', hex: '#FF0000' }, { name: 'Burgundy', hex: '#800020' },
  { name: 'Blue', hex: '#0000FF' }, { name: 'Light Blue', hex: '#ADD8E6' },
  { name: 'Green', hex: '#008000' }, { name: 'Olive', hex: '#808000' },
  { name: 'Khaki', hex: '#F0E68C' }, { name: 'Beige', hex: '#F5F5DC' },
  { name: 'Brown', hex: '#A52A2A' }, { name: 'Tan', hex: '#D2B48C' },
  { name: 'Pink', hex: '#FFC0CB' }, { name: 'Purple', hex: '#800080' },
  { name: 'Orange', hex: '#FFA500' }, { name: 'Yellow', hex: '#FFFF00' },
];
const BY_NAME = new Map(PRODUCT_COLORS.map(c => [c.name.toLowerCase(), c]));
const BY_HEX = new Map(PRODUCT_COLORS.map(c => [c.hex.toLowerCase(), c]));

const PALETTE: Array<[string, [number, number, number]]> = [
  ['Black', [0, 0, 0]],
  ['Charcoal', [54, 69, 79]],
  ['Dark Grey', [85, 85, 85]],
  ['Grey', [128, 128, 128]],
  ['Light Grey', [200, 200, 200]],
  ['White', [255, 255, 255]],
  ['Off-White', [245, 240, 232]],
  ['Beige', [222, 205, 175]],
  ['Cream', [255, 253, 208]],
  ['Brown', [120, 72, 40]],
  ['Tan', [210, 180, 140]],
  ['Khaki', [195, 176, 145]],
  ['Olive', [107, 112, 50]],
  ['Army Green', [75, 83, 32]],
  ['Green', [34, 139, 34]],
  ['Mint', [152, 255, 152]],
  ['Teal', [0, 128, 128]],
  ['Navy', [0, 0, 128]],
  ['Blue', [30, 90, 200]],
  ['Sky Blue', [135, 206, 235]],
  ['Denim', [21, 96, 189]],
  ['Purple', [128, 0, 128]],
  ['Lavender', [200, 180, 230]],
  ['Pink', [255, 160, 190]],
  ['Hot Pink', [255, 20, 147]],
  ['Red', [210, 20, 30]],
  ['Maroon', [128, 0, 0]],
  ['Burgundy', [128, 0, 32]],
  ['Orange', [255, 140, 0]],
  ['Coral', [255, 127, 80]],
  ['Yellow', [250, 215, 30]],
  ['Mustard', [225, 173, 1]],
  ['Gold', [212, 175, 55]],
  ['Silver', [192, 192, 192]],
];

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** "#000000" → "Black"; "navy blue" → "Navy Blue"; unknown hex → nearest named colour. */
export function colorName(value: string): string {
  const known = BY_HEX.get(value.trim().toLowerCase()) || BY_NAME.get(value.trim().toLowerCase());
  if (known) return known.name;
  const rgb = hexToRgb(value);
  if (!rgb) return value.replace(/\b\w/g, c => c.toUpperCase());
  let best = PALETTE[0][0];
  let bestDist = Infinity;
  for (const [name, [r, g, b]] of PALETTE) {
    // Weighted RGB distance — cheap and close enough to how people perceive colour
    const d = 2 * (rgb[0] - r) ** 2 + 4 * (rgb[1] - g) ** 2 + 3 * (rgb[2] - b) ** 2;
    if (d < bestDist) { bestDist = d; best = name; }
  }
  return best;
}

/**
 * CSS colour for a swatch. Admin-created products store names like "Light Blue",
 * which browsers don't understand (multi-word names aren't CSS colours), so map
 * them to their hex first. Very light colours get a faint tint to stay visible on white.
 */
export function swatchColor(value: string): string {
  const v = value.trim().toLowerCase();
  const known = BY_NAME.get(v);
  if (known) return known.hex;
  if (v === 'white' || v === '#ffffff' || v === '#fff') return '#f5f5f5';
  if (v === 'beige') return '#f5f0e8';
  return v;
}
