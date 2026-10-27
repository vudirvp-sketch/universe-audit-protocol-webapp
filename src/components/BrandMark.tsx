/**
 * BrandMark — собственный знак продукта «Протокол аудита вселенной».
 *
 * Знак: волосяная квадратная рамка (документ) и три горизонтальные линейки
 * убывающей длины — блоки протокола, сходящиеся к вердикту. Никаких букв,
 * сторонних леттерформ, градиентов, теней и цветных акцентов: только токены
 * темы (muted-foreground для рамки, foreground для линеек).
 *
 * Встроен, а не <img src="/logo.svg">: статический экспорт уезжает под
 * /<repo>/ (NEXT_BASE_PATH), и абсолютный путь к картинке там ломается.
 * Декоративный: рядом всегда есть текстовое название, поэтому aria-hidden.
 *
 * `animated` сохранён в типе пропсов ради совместимости вызовов и намеренно
 * ничего не делает (no-op): дизайн-спека v16 запрещает декоративную анимацию
 * (дыхание/пульс) на знаке.
 */
export function BrandMark({
  size = 28,
}: {
  size?: number;
  animated?: boolean;
}) {
  return (
    <span className="inline-flex shrink-0" aria-hidden="true">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
      >
        <rect
          x="4"
          y="4"
          width="24"
          height="24"
          rx="3"
          fill="none"
          stroke="var(--muted-foreground)"
          strokeWidth="1.5"
        />
        <g fill="var(--foreground)">
          <rect x="9" y="10" width="14" height="2" />
          <rect x="9" y="15" width="11" height="2" />
          <rect x="9" y="20" width="8" height="2" />
        </g>
      </svg>
    </span>
  );
}
