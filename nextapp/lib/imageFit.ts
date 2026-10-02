import type { SyntheticEvent } from 'react';

/*
 * Product frames are portrait 3:4. Photos already close to that shape fill the
 * frame (cover — nothing important is lost). Anything else (square, landscape,
 * very tall) is shown whole (contain) so sleeves, hands and soles aren't cut off.
 * CSS reads the data-fit attribute; contain is the default until the image loads.
 */
export function fitToFrame(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  const ratio = img.naturalWidth / img.naturalHeight;
  img.dataset.fit = ratio > 0.7 && ratio < 0.82 ? 'cover' : 'contain';
}
