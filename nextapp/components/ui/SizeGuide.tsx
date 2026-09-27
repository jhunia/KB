'use client';
import { useEffect, useRef } from 'react';

// General-purpose charts; individual brands can run slightly large or small.
const TOPS = {
  caption: 'Tops, shirts, hoodies & jackets — body measurements',
  head: ['Size', 'Chest (cm)', 'Chest (in)'],
  rows: [['XS', '81–86', '32–34'], ['S', '86–94', '34–37'], ['M', '94–102', '37–40'], ['L', '102–110', '40–43'], ['XL', '110–118', '43–46'], ['XXL', '118–126', '46–50']],
};
const BOTTOMS = {
  caption: 'Jeans & trousers — body measurements',
  head: ['Size', 'Waist (cm)', 'Waist (in)'],
  rows: [['XS', '66–71', '26–28'], ['S', '71–76', '28–30'], ['M', '76–84', '30–33'], ['L', '84–91', '33–36'], ['XL', '91–99', '36–39'], ['XXL', '99–107', '39–42']],
};
const SHOES = {
  caption: 'Footwear — size conversion',
  head: ['EU', 'UK', 'US (men)', 'Foot length (cm)'],
  rows: [['39', '6', '6.5', '24.5'], ['40', '6.5', '7', '25'], ['41', '7.5', '8', '26'], ['42', '8', '8.5', '26.5'], ['43', '9', '9.5', '27.5'], ['44', '9.5', '10', '28'], ['45', '10.5', '11', '29']],
};

function chartsFor(category: string) {
  if (category === 'shoes') return [SHOES];
  if (category === 'jeans') return [BOTTOMS];
  if (category === 'suits') return [TOPS, BOTTOMS];
  return [TOPS];
}

export default function SizeGuide({ category, onClose }: { category: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="size-guide-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="size-guide" role="dialog" aria-modal="true" aria-labelledby="size-guide-title">
        <div className="modal-header">
          <h3 id="size-guide-title">Size Guide</h3>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close size guide">✕</button>
        </div>
        {chartsFor(category).map(chart => (
          <table key={chart.caption} className="size-guide-table">
            <caption>{chart.caption}</caption>
            <thead><tr>{chart.head.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {chart.rows.map(r => (
                <tr key={r[0]}>{r.map((c, i) => i === 0 ? <th key={i} scope="row">{c}</th> : <td key={i}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        ))}
        <p className="size-guide-note">
          This is a general guide — fit can vary by brand. Between sizes? Choose the larger one for a relaxed fit.
          Not sure? Contact us before ordering and we&apos;ll help you pick.
        </p>
      </div>
    </div>
  );
}
