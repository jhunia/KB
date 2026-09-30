import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      textAlign: 'center',
      background: 'var(--white)',
    }}>
      {/* Big 404 */}
      <div style={{
        fontSize: 'clamp(80px, 20vw, 160px)',
        fontWeight: 900,
        lineHeight: 1,
        letterSpacing: '-4px',
        color: 'transparent',
        WebkitTextStroke: '2px var(--black)',
        userSelect: 'none',
        marginBottom: 8,
      }}>
        404
      </div>

      <h1 style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 'clamp(22px, 5vw, 36px)',
        fontWeight: 800,
        marginBottom: 16,
        letterSpacing: '-0.5px',
      }}>
        Page Not Found
      </h1>

      <p style={{
        fontSize: 16,
        color: 'var(--gray-600)',
        maxWidth: 400,
        lineHeight: 1.6,
        marginBottom: 40,
      }}>
        Looks like this page doesn&apos;t exist or was moved. Let&apos;s get you back to something good.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/" className="btn btn-primary">
          Go Home
        </Link>
        <Link href="/category" className="btn btn-outline">
          Browse Shop
        </Link>
      </div>

      {/* Decorative label */}
      <p style={{
        marginTop: 60,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 3,
        color: 'var(--gray-400)',
        textTransform: 'uppercase',
      }}>
        stress_d
      </p>
    </main>
  );
}
