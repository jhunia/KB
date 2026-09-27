// Placeholder with the same shape as ProductCard, shown while products load
export default function ProductCardSkeleton({ carousel = false }: { carousel?: boolean }) {
  return (
    <div
      className="product-card product-card-skeleton"
      style={carousel ? { minWidth: 260, width: 260, maxWidth: 260, flexShrink: 0 } : undefined}
      aria-hidden="true"
    >
      <div className="product-card-img skeleton" />
      <div className="skeleton" style={{ height: 18, width: '80%', borderRadius: 6, marginTop: 14 }} />
      <div className="skeleton" style={{ height: 18, width: '40%', borderRadius: 6, marginTop: 10 }} />
    </div>
  );
}
