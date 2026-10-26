import * as React from 'react';

/** Фирменный знак из public/logo.svg. Декоративный: название всегда рядом текстом. */
export function BrandMark({ size = 24 }: { size?: number }) {
  return <img src="/logo.svg" alt="" width={size} height={size} className="shrink-0" />;
}
