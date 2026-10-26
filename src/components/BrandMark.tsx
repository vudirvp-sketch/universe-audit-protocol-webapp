/**
 * BrandMark — фирменный знак из public/logo.svg, встроенный в разметку.
 *
 * Встроен, а не <img src="/logo.svg">: статический экспорт уезжает под
 * /<repo>/ (NEXT_BASE_PATH), и абсолютный путь к картинке там ломается.
 * Декоративный: рядом всегда есть текстовое название, поэтому aria-hidden.
 */
export function BrandMark({ size = 28, animated = true }: { size?: number; animated?: boolean }) {
  return (
    <span className="inline-flex shrink-0" aria-hidden="true">
      {animated && (
        <style>{`
          @keyframes brand-breathe {
            0%, 100% { opacity: 0.72; }
            50% { opacity: 1; }
          }
          .brand-breathe { animation: brand-breathe 2.5s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) {
            .brand-breathe { animation: none; }
          }
        `}</style>
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 30 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
      >
        <path
          d="M24.51,28.51H5.49c-2.21,0-4-1.79-4-4V5.49c0-2.21,1.79-4,4-4h19.03c2.21,0,4,1.79,4,4v19.03C28.51,26.72,26.72,28.51,24.51,28.51z"
          fill="var(--card)"
          stroke="var(--muted-foreground)"
          strokeWidth="0.7"
        />
        <g className={animated ? 'brand-breathe' : undefined} fill="var(--foreground)">
          <path d="M15.47,7.1l-1.3,1.85c-0.2,0.29-0.54,0.47-0.9,0.47h-7.1V7.09C6.16,7.1,15.47,7.1,15.47,7.1z" />
          <polygon points="24.3,7.1 13.14,22.91 5.7,22.91 16.86,7.1" />
          <path d="M14.53,22.91l1.31-1.86c0.2-0.29,0.54-0.47,0.9-0.47h7.09v2.33H14.53z" />
        </g>
      </svg>
    </span>
  );
}
