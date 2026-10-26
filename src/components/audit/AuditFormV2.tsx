'use client';

import * as React from 'react';
import { useAuditStateV3 } from '@/hooks/useAuditStateV3';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  BookOpen,
  ChevronDown,
  Dices,
  Eye,
  Gamepad2,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { cn, pluralRu } from '@/lib/utils';
import type { AuditMaterial, GuidedContext, MediaType } from '@/lib/audit/types-v3';
import { t } from '@/lib/i18n/ru';

// ─── Media type labels & icons ────────────────────────────────────────

const MEDIA_TYPE_OPTIONS: { value: MediaType; label: string; icon: React.ReactNode }[] = [
  { value: 'narrative', label: t.form.mediaNarrative, icon: <BookOpen className="h-4 w-4" /> },
  { value: 'game', label: t.form.mediaGame, icon: <Gamepad2 className="h-4 w-4" /> },
  { value: 'visual', label: t.form.mediaVisual, icon: <Eye className="h-4 w-4" /> },
  { value: 'ttrpg', label: t.form.mediaTtrpg, icon: <Dices className="h-4 w-4" /> },
];

// ─── Guided framing fields ────────────────────────────────────────────

const GUIDED_TEXT_FIELDS = [
  { key: 'genre', label: t.form.guidedGenre, placeholder: t.form.guidedGenrePlaceholder },
  { key: 'targetAudience', label: t.form.guidedAudience, placeholder: t.form.guidedAudiencePlaceholder },
  { key: 'targetExperience', label: t.form.guidedExperience, placeholder: t.form.guidedExperiencePlaceholder },
] as const;

const GUIDED_AREA_FIELDS = [
  { key: 'nonNegotiables', label: t.form.guidedNonNegotiables, placeholder: t.form.guidedNonNegotiablesPlaceholder },
  { key: 'knownConcerns', label: t.form.guidedKnownConcerns, placeholder: t.form.guidedKnownConcernsPlaceholder },
  { key: 'excludedConcerns', label: t.form.guidedExcludedConcerns, placeholder: t.form.guidedExcludedConcernsPlaceholder },
] as const;

const GUIDED_KEYS = [
  'genre',
  'targetAudience',
  'targetExperience',
  'nonNegotiables',
  'knownConcerns',
  'excludedConcerns',
] as const;

// Artefact text is re-sent in every one of the 13 requests and stored in
// localStorage, so uploads are bounded rather than unbounded.
const MAX_MATERIAL_FILE_BYTES = 512 * 1024; // 512 KB on disk
const MAX_MATERIAL_CHARS = 100_000;         // per artefact, in characters

// Нижняя граница осмысленного запуска: на более коротком тексте протоколу
// нечего проверять, и аудит возвращает общие места.
const MIN_INPUT_CHARS = 50;

/** Drop empty guided fields so an empty framing never switches the audit away from lazy mode. */
function buildGuidedPayload(guided: GuidedContext): GuidedContext {
  const payload: GuidedContext = {};
  for (const key of GUIDED_KEYS) {
    const value = guided[key]?.trim();
    if (value) payload[key] = value;
  }
  return payload;
}

/** Drop rows without text and give unnamed artefacts a readable label. */
function buildMaterialsPayload(materials: AuditMaterial[]): AuditMaterial[] {
  return materials
    .filter((material) => material.text.trim().length > 0)
    .map((material, index) => ({
      label:
        material.label.trim() ||
        t.form.materialFallbackLabel.replace('{n}', String(index + 1)),
      text: material.text.trim(),
    }));
}

// ─── Props ────────────────────────────────────────────────────────────

export interface AuditFormSubmitInput {
  text: string;
  mediaType: MediaType;
  guided?: GuidedContext;
  materials?: AuditMaterial[];
}

interface AuditFormV2Props {
  onSubmit: (input: AuditFormSubmitInput) => void;
  isLoading?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────

export function AuditFormV2({ onSubmit, isLoading = false }: AuditFormV2Props) {
  const {
    inputText,
    setInputText,
    mediaType,
    setMediaType,
    guided,
    setGuided,
    materials,
    setMaterials,
  } = useAuditStateV3();

  const guidedPanelId = React.useId();
  const materialsPanelId = React.useId();
  const conceptCountId = React.useId();
  const conceptMinHintId = React.useId();
  const mediaGroupLabelId = React.useId();

  // Collapsible sections start closed — both are optional.
  const [guidedOpen, setGuidedOpen] = React.useState(false);
  const [materialsOpen, setMaterialsOpen] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);

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

  // ── Character counter and the 50-character floor ───────────────────
  // Считаем по обрезанному тексту: пробелы и переводы строк не дают запуску
  // аудита ни одного проверяемого утверждения.
  const charCount = localInput.trim().length;
  const remainingChars = Math.max(0, MIN_INPUT_CHARS - charCount);
  const characterCountText = t.form.characterCount
    .replace('{count}', String(charCount))
    .replace('{unit}', pluralRu(charCount, t.form.charUnits));
  const minCharsHint =
    charCount === 0
      ? t.form.minCharsWarning
          .replace('{min}', String(MIN_INPUT_CHARS))
          .replace('{unit}', pluralRu(MIN_INPUT_CHARS, t.form.charUnits))
      : remainingChars > 0
        ? t.form.minCharsBlocked
            .replace('{count}', String(remainingChars))
            .replace('{unit}', pluralRu(remainingChars, t.form.charUnits))
        : null;
  const canSubmit = !isLoading && remainingChars === 0;
  const conceptDescribedBy = minCharsHint
    ? `${conceptCountId} ${conceptMinHintId}`
    : conceptCountId;

  // ── Artefact handlers ──────────────────────────────────────────────

  const addMaterial = () => {
    setMaterials([...materials, { label: '', text: '' }]);
  };

  const removeMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const updateMaterial = (index: number, patch: Partial<AuditMaterial>) => {
    setMaterials(materials.map((material, i) => (i === index ? { ...material, ...patch } : material)));
  };

  const handleMaterialFile = (index: number, file: File | undefined) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.txt') && !name.endsWith('.md')) {
      setFileError(t.form.fileTypeError);
      return;
    }
    // Artefact text is injected into every prompt and persisted to localStorage,
    // so an unbounded upload can blow the model context and the storage quota.
    if (file.size > MAX_MATERIAL_FILE_BYTES) {
      setFileError(t.form.fileTooLargeError);
      return;
    }

    const target = materials[index];
    const reader = new FileReader();
    reader.onerror = () => setFileError(t.form.fileReadError);
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      if (!content.trim()) {
        setFileError(t.form.fileEmptyError);
        return;
      }
      // Non-UTF-8 files decode to U+FFFD instead of failing silently.
      if (content.includes('\uFFFD')) {
        setFileError(t.form.fileEncodingError);
        return;
      }
      if (content.length > MAX_MATERIAL_CHARS) {
        setFileError(t.form.fileTooLargeError);
        return;
      }
      // The row may have been deleted or replaced while the file was read —
      // locate it by identity instead of trusting the captured index, and read
      // the freshest store snapshot rather than the render-time closure.
      const state = useAuditStateV3.getState();
      const currentIndex = state.materials.indexOf(target);
      if (currentIndex === -1) {
        setFileError(null);
        return;
      }
      const current = state.materials[currentIndex];
      const nextText = current.text.trim() ? `${current.text}\n\n${content}` : content;
      if (nextText.length > MAX_MATERIAL_CHARS) {
        setFileError(t.form.fileTooLargeError);
        return;
      }
      state.setMaterials(
        state.materials.map((material, i) => (i === currentIndex ? { ...material, text: nextText } : material)),
      );
      setFileError(null);
    };
    reader.readAsText(file);
  };

  // ── Submit / clear ─────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (localInput.trim().length < MIN_INPUT_CHARS) return;

    // Flush debounce: immediately sync localInput to Zustand
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setInputText(localInput);

    const guidedPayload = buildGuidedPayload(guided);
    const materialsPayload = buildMaterialsPayload(materials);

    onSubmit({
      text: localInput,
      mediaType,
      ...(Object.keys(guidedPayload).length > 0 ? { guided: guidedPayload } : {}),
      ...(materialsPayload.length > 0 ? { materials: materialsPayload } : {}),
    });
  };

  const handleClear = () => {
    // Cancel the pending debounce first, otherwise the timer re-commits the
    // text that was just cleared (~300 ms later).
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setLocalInput('');
    setInputText('');
    setGuided({
      genre: '',
      targetAudience: '',
      targetExperience: '',
      nonNegotiables: '',
      knownConcerns: '',
      excludedConcerns: '',
    });
    setMaterials([]);
    setFileError(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Concept — секция на волосяной линии, без карточки */}
      <section className="space-y-4 border-t border-border pt-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Концепт</h2>
          <p className="text-sm text-muted-foreground">
            Введите описание вашего концепта для анализа
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="concept-text" className="text-sm font-normal text-muted-foreground">
            Текст концепта
          </Label>
          <Textarea
            id="concept-text"
            placeholder="Опишите ваш концепт — от пары предложений до целого рассказа..."
            value={localInput}
            onChange={(e) => handleInputTextChange(e.target.value)}
            aria-describedby={conceptDescribedBy}
            className="min-h-[200px] resize-y"
            disabled={isLoading}
          />
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p id={conceptCountId} className="text-sm text-muted-foreground tabular-nums">
              {characterCountText}
            </p>
            {minCharsHint && (
              <p id={conceptMinHintId} className="text-sm text-muted-foreground tabular-nums">
                {minCharsHint}
              </p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{t.app.inputHint}</p>
        </div>

        {/* Media type — видимые переключатели, не Select */}
        <div className="space-y-2">
          <p id={mediaGroupLabelId} className="text-sm text-muted-foreground">
            {t.form.mediaType}
          </p>
          <div
            role="radiogroup"
            aria-labelledby={mediaGroupLabelId}
            className="flex flex-wrap gap-2"
          >
            {MEDIA_TYPE_OPTIONS.map((option) => {
              const selected = mediaType === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={isLoading}
                  onClick={() => setMediaType(option.value)}
                  className={cn(
                    'inline-flex min-h-9 items-center gap-2 rounded-sm border px-3 text-sm transition-colors disabled:pointer-events-none disabled:opacity-50',
                    selected
                      ? 'border-foreground/40 bg-accent text-foreground'
                      : 'border-border text-muted-foreground hover:border-input hover:text-foreground',
                  )}
                >
                  {option.icon}
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Guided framing — v16 §2 GUIDED MODE */}
      <section className="border-t border-border pt-5">
        <button
          type="button"
          onClick={() => setGuidedOpen((open) => !open)}
          aria-expanded={guidedOpen}
          aria-controls={guidedPanelId}
          className="flex w-full items-start justify-between gap-4 text-left"
        >
          <span className="min-w-0 space-y-1">
            <span className="block text-base font-semibold">{t.form.guidedTitle}</span>
            <span className="block text-sm text-muted-foreground">
              {t.form.guidedDescription}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              guidedOpen && 'rotate-180',
            )}
          />
        </button>

        <div id={guidedPanelId} hidden={!guidedOpen} className="space-y-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {GUIDED_TEXT_FIELDS.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label
                  htmlFor={`guided-${field.key}`}
                  className="text-sm font-normal text-muted-foreground"
                >
                  {field.label}
                </Label>
                <Input
                  id={`guided-${field.key}`}
                  value={guided[field.key] ?? ''}
                  placeholder={field.placeholder}
                  onChange={(e) => setGuided({ [field.key]: e.target.value })}
                  disabled={isLoading}
                />
              </div>
            ))}
          </div>

          {GUIDED_AREA_FIELDS.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label
                htmlFor={`guided-${field.key}`}
                className="text-sm font-normal text-muted-foreground"
              >
                {field.label}
              </Label>
              <Textarea
                id={`guided-${field.key}`}
                value={guided[field.key] ?? ''}
                placeholder={field.placeholder}
                onChange={(e) => setGuided({ [field.key]: e.target.value })}
                className="min-h-[72px] resize-y"
                disabled={isLoading}
              />
            </div>
          ))}

          <p className="text-sm text-muted-foreground">{t.form.guidedHint}</p>
        </div>
      </section>

      {/* Additional artefacts — v16 §2 MATERIAL-AWARE MODE */}
      <section className="border-t border-border pt-5">
        <button
          type="button"
          onClick={() => setMaterialsOpen((open) => !open)}
          aria-expanded={materialsOpen}
          aria-controls={materialsPanelId}
          className="flex w-full items-start justify-between gap-4 text-left"
        >
          <span className="min-w-0 space-y-1">
            <span className="block text-base font-semibold">{t.form.materialsTitle}</span>
            <span className="block text-sm text-muted-foreground">
              {t.form.materialsDescription}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              materialsOpen && 'rotate-180',
            )}
          />
        </button>

        <div id={materialsPanelId} hidden={!materialsOpen} className="space-y-4 pt-4">
          {materials.length === 0 && (
            <p className="text-sm text-muted-foreground">{t.form.materialsHint}</p>
          )}

          {materials.map((material, index) => (
            <div key={index} className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {t.form.materialRowTitle.replace('{n}', String(index + 1))}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMaterial(index)}
                  disabled={isLoading}
                  aria-label={`${t.form.removeMaterial} ${index + 1}`}
                  className="h-8 w-8 rounded-sm text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor={`material-label-${index}`}
                  className="text-sm font-normal text-muted-foreground"
                >
                  {t.form.materialLabel}
                </Label>
                <Input
                  id={`material-label-${index}`}
                  value={material.label}
                  placeholder={t.form.materialLabelPlaceholder}
                  onChange={(e) => updateMaterial(index, { label: e.target.value })}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor={`material-text-${index}`}
                  className="text-sm font-normal text-muted-foreground"
                >
                  {t.form.materialText}
                </Label>
                <Textarea
                  id={`material-text-${index}`}
                  value={material.text}
                  placeholder={t.form.materialTextPlaceholder}
                  onChange={(e) => updateMaterial(index, { text: e.target.value })}
                  className="min-h-[120px] resize-y"
                  disabled={isLoading}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {t.form.materialChars.replace('{count}', String(material.text.length))}
                  </span>
                  <input
                    type="file"
                    accept=".txt,.md,text/plain,text/markdown"
                    aria-label={`${t.form.materialUpload} ${index + 1}`}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      handleMaterialFile(index, file);
                    }}
                    disabled={isLoading}
                    className="block w-full max-w-full text-sm text-muted-foreground file:mr-3 file:rounded-sm file:border file:border-input file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent disabled:pointer-events-none disabled:opacity-50 sm:max-w-[260px]"
                  />
                </div>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addMaterial}
            disabled={isLoading}
            className="rounded-sm"
          >
            <Plus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {t.form.addMaterial}
          </Button>

          {fileError && (
            <p role="alert" className="text-sm text-severity-critical">
              {fileError}
            </p>
          )}
        </div>
      </section>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
        <Button
          type="button"
          variant="outline"
          onClick={handleClear}
          disabled={isLoading}
          className="rounded-sm"
        >
          {t.app.clear}
        </Button>
        <Button
          type="submit"
          disabled={!canSubmit}
          aria-describedby={minCharsHint ? conceptMinHintId : undefined}
          className="min-w-[180px] rounded-sm bg-primary text-primary-foreground"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t.app.analyzing}
            </>
          ) : (
            t.app.startAudit
          )}
        </Button>
      </div>
    </form>
  );
}
