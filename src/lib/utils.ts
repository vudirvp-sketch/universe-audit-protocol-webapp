import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Формы русского склонения: [одна, две–четыре, ноль/пять+]. */
export type PluralForms = readonly [string, string, string];

/** Русское склонение: pluralRu(2, ['часть', 'части', 'частей']) → "части". */
export function pluralRu(count: number, forms: PluralForms): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

/** "3 части" — число и его форма через неразрывный пробел. */
export function formatPlural(count: number, forms: PluralForms): string {
  return `${count}\u00A0${pluralRu(count, forms)}`;
}
