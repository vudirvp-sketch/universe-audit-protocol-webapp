'use client';

import * as React from 'react';
import { useAuditStateV3 } from '@/hooks/useAuditStateV3';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { cn, pluralRu } from '@/lib/utils';
import type { MediaType } from '@/lib/audit/types-v3';
import { t } from '@/lib/i18n/ru';

/** Минимум, ниже которого аудит вырождается в догадки (см. протокол, раздел 0). */
const MIN_CONCEPT_CHARS = 50;

// ─── Типы медиа ───────────────────────────────────────────────────────

const MEDIA_TYPE_OPTIONS: { value: MediaType; label: string }[] = [
  { value: 'narrative', label: 'Нарратив' },
  { value: 'game', label: 'Игра' },
  { value: 'visual', label: 'Визуальное' },
  { value: 'ttrpg', label: 'Настольная RPG' },
];

// ─── Props ────────────────────────────────────────────────────────────

interface AuditFormV2Props {
  onSubmit: (input: { text: string; mediaType: MediaType }) => void;
  isLoading?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────

export function AuditFormV2({ onSubmit, isLoading = false }: AuditFormV2Props) {
  const {
    inputText,
    setInputText,
    mediaType,
    setMediaType,
  } = useAuditStateV3();

  // Local input with debounce (same pattern as AuditForm to avoid
  // excessive Zustand writes on every keystroke)
  const [localInput, setLocalInput] = React.useState(inputText);
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local input when external inputText changes (e.g. on reset)
  React.useEffect(() => {
    setLocalInput(inputText);
  }, [inputText]);

  const handleInputTextChange = (value: string) => {
    setLocalInput(value);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setInputText(value);
    }, 300);
  };

  // Cleanup debounce timer on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (localInput.trim().length < MIN_CONCEPT_CHARS) return;

    // Flush debounce: immediately sync localInput to Zustand
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setInputText(localInput);

    onSubmit({ text: localInput, mediaType });
  };

  const handleClear = () => {
    setLocalInput('');
    setInputText('');
  };

  const charCount = localInput.trim().length;
  const remaining = Math.max(0, MIN_CONCEPT_CHARS - charCount);
  const countUnit = pluralRu(charCount, t.form.charUnits);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-2">
        <Label htmlFor="concept-text" className="text-base font-semibold">Текст концепта</Label>
        <p id="concept-hint" className="text-sm text-muted-foreground">
          От пары предложений до целого рассказа. Длинные тексты обрабатываются автоматически.
        </p>
        <Textarea
          id="concept-text"
          aria-describedby="concept-hint concept-count concept-min"
          placeholder="Опишите мир, героев и главный конфликт…"
          value={localInput}
          onChange={(e) => handleInputTextChange(e.target.value)}
          className="min-h-[260px] resize-y text-base leading-relaxed"
          disabled={isLoading}
        />
        <p id="concept-count" className="text-sm tabular-nums text-muted-foreground">
          {charCount.toLocaleString('ru-RU')} {countUnit}
        </p>
        {charCount < MIN_CONCEPT_CHARS && (
          <p id="concept-min" className="text-sm text-muted-foreground">
            {charCount === 0
              ? t.form.minCharsWarning
                  .replace('{min}', String(MIN_CONCEPT_CHARS))
                  .replace('{unit}', pluralRu(MIN_CONCEPT_CHARS, t.form.charUnits))
              : t.form.minCharsBlocked
                  .replace('{count}', String(remaining))
                  .replace('{unit}', pluralRu(remaining, t.form.charUnits))}
          </p>
        )}
      </div>

      <fieldset className="space-y-2" disabled={isLoading}>
        <legend className="text-base font-semibold">Тип медиа</legend>
        <div role="radiogroup" aria-label="Тип медиа" className="flex flex-wrap gap-2">
          {MEDIA_TYPE_OPTIONS.map((option) => {
            const selected = mediaType === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setMediaType(option.value)}
                className={cn(
                  'rounded-sm border px-4 py-2 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50',
                  selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-transparent hover:bg-accent',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="ghost" onClick={handleClear} disabled={isLoading || !localInput}>
          Очистить
        </Button>
        <Button type="submit" size="lg" disabled={charCount < MIN_CONCEPT_CHARS || isLoading} className="min-w-[180px]">
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Анализируем…
            </>
          ) : (
            'Начать аудит'
          )}
        </Button>
      </div>
    </form>
  );
}
