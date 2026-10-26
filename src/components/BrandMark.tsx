/**
 * BrandMark — компактный знак аудита мира: сфера, орбита и отметка проверки.
 *
 * Встроен в разметку, а не загружается через абсолютный URL: так знак
 * работает и при статическом экспорте под /<repo>/ (NEXT_BASE_PATH).
 * Декоративный: рядом всегда есть текстовое название, поэтому aria-hidden.
 */
export function BrandMark({ size = 28, animated = true }: { size?: number; animated?: boolean }) {
  return (
    <span className="inline-flex shrink-0" aria-hidden="true">
      {animated && (
        <style>{`
          @keyframes brand-breathe {
            0%, 100% { opacity: 0.82; }
            50% { opacity: 1; }
          }
          .brand-breathe { animation: brand-breathe 3.5s ease-in-out infinite; }
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
        <rect
          x="1.5"
          y="1.5"
          width="27"
          height="27"
          rx="3.5"
          fill="var(--card)"
          stroke="var(--muted-foreground)"
          strokeWidth="0.75"
        />
        <g
          className={animated ? 'brand-breathe' : undefined}
          stroke="var(--foreground)"
          strokeWidth="0.95"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Sphere and meridians */}
          <circle cx="15" cy="15" r="8.1" />
          <path d="M15 6.9C10.7 9.2 10.7 20.8 15 23.1" />
          <path d="M15 6.9C19.3 9.2 19.3 20.8 15 23.1" />

          {/* Orbit crossing the world model */}
          <path d="M5.1 15c1.8-4.1 22-4.1 23.8 0-1.8 4.1-22 4.1-23.8 0Z" />

          {/* Verification point sits above the orbit */}
          <circle cx="15" cy="15" r="3.05" fill="var(--card)" />
          <path d="m13.45 15.05 1.15 1.15 2.05-2.3" strokeWidth="1.15" />
        </g>
      </svg>
    </span>
  );
}
