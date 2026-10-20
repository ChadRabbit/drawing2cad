/** The mark: a sheet's corner folding up into a solid. */
export default function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 7h16v18H4z" fill="currentColor" opacity="0.32" />
      <path d="M12 4l16 5v18l-16-5z" fill="currentColor" />
    </svg>
  );
}
