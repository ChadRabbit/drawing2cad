export function CoinGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" fill="#dafa9c" stroke="#0f0f0f" strokeWidth="1.3" />
      <path d="M5.5 8h5M8 5.5v5" stroke="#0f0f0f" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
