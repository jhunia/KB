import Image from 'next/image';

/*
 * stress_d logo. Files live in /public/brand (letters are outlined, so they
 * look identical everywhere):
 *   - "wordmark": lowercase "fracture" stress_d — site header, sign-in, admin
 *   - "badge":    the round seal with ring text — footer, socials, tags
 */
const WORDMARK_RATIO = 438 / 106; // width / height of stressd-wordmark-*.svg

export default function Logo({ variant = 'wordmark', tone = 'black', size }: {
  variant?: 'wordmark' | 'badge';
  tone?: 'black' | 'white';
  /** badge: diameter in px · wordmark: height in px */
  size?: number;
}) {
  if (variant === 'badge') {
    const s = size ?? 96;
    return <Image src={`/brand/stressd-badge-${tone}.svg`} alt="stress_d — est. 2026" width={s} height={s} unoptimized />;
  }
  const h = size ?? 30;
  return (
    <Image
      src={`/brand/stressd-wordmark-${tone}.svg`}
      alt="stress_d"
      width={Math.round(h * WORDMARK_RATIO)}
      height={h}
      className="logo-wordmark"
      unoptimized
      priority
    />
  );
}
