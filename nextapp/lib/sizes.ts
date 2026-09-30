/* Size helpers for the shop filter. Products store sizes as the admin typed them
   ("Small", "M", "X-Large", "32", "42", "40R", "One Size"), so the filter works
   on a normalised form and is built from the sizes products actually have. */

const WORDS: Record<string, string> = {
  'extra small': 'XS', 'x-small': 'XS', xsmall: 'XS', small: 'S', medium: 'M', large: 'L',
  'extra large': 'XL', 'x-large': 'XL', xlarge: 'XL', 'xx-large': 'XXL', xxlarge: 'XXL', 'xxx-large': 'XXXL',
};
const LETTER_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

/** "Small" → "S", "x-large" → "XL", "42" → "42", "one size" → "One Size" */
export function normalizeSize(size: string): string {
  const s = size.trim();
  const word = WORDS[s.toLowerCase()];
  if (word) return word;
  if (LETTER_ORDER.includes(s.toUpperCase())) return s.toUpperCase();
  if (/^one\s*size$/i.test(s)) return 'One Size';
  return s.toUpperCase();
}

/** Sizes present in the catalogue, grouped for display */
export function sizeGroups(allSizes: string[]) {
  const set = new Set(allSizes.map(normalizeSize));
  const letters = LETTER_ORDER.filter(s => set.has(s));
  const numeric = [...set].filter(s => /^\d+(\.\d+)?$/.test(s)).sort((a, b) => Number(a) - Number(b));
  const other = [...set].filter(s => !letters.includes(s) && !numeric.includes(s)).sort();
  return [
    { label: 'Clothing', sizes: letters },
    { label: 'Waist & shoe sizes', sizes: numeric },
    { label: 'Other', sizes: other },
  ].filter(g => g.sizes.length);
}
