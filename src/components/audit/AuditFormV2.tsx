'use client';

import * as React from 'react';
import { useAuditStateV3 } from '@/hooks/useAuditStateV3';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sparkles,
  BookOpen,
  Gamepad2,
  Eye,
  Dices,
  ChevronDown,
  Plus,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

    if (!localInput.trim()) return;

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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Concept Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Концепт
          </CardTitle>
          <CardDescription>
            Введите описание вашего концепта для анализа
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="concept-text">Текст концепта</Label>
            <Textarea
              id="concept-text"
              placeholder="Опишите ваш концепт — от пары предложений до целого рассказа..."
              value={localInput}
              onChange={(e) => handleInputTextChange(e.target.value)}
              className="min-h-[200px] resize-y"
              disabled={isLoading}
            />
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">
                {localInput.length} символов
              </p>
              <p className="text-sm text-muted-foreground">
                Введите концепт — от пары предложений до целого рассказа. Длинные тексты обрабатываются автоматически.
              </p>
            </div>
          </div>

          {/* Media Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="audit-media-type">Тип медиа</Label>
            <Select
              value={mediaType}
              onValueChange={(v) => setMediaType(v as MediaType)}
              disabled={isLoading}
            >
              <SelectTrigger id="audit-media-type">
                <SelectValue placeholder={t.form.mediaTypeSelect} />
              </SelectTrigger>
              <SelectContent>
                {MEDIA_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      {option.icon}
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Guided framing — v16 §2 GUIDED MODE */}
      <Card className="py-4">
        <button
          type="button"
          onClick={() => setGuidedOpen((open) => !open)}
          aria-expanded={guidedOpen}
          aria-controls={guidedPanelId}
          className="flex w-full items-start justify-between gap-4 px-6 text-left"
        >
          <span className="min-w-0">
            <span className="block text-base font-semibold">{t.form.guidedTitle}</span>
            <span className="block text-sm text-muted-foreground">
              {t.form.guidedDescription}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform',
              guidedOpen && 'rotate-180',
            )}
          />
        </button>

          <div id={guidedPanelId} hidden={!guidedOpen} className="px-6 pt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {GUIDED_TEXT_FIELDS.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={`guided-${field.key}`}>{field.label}</Label>
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
                <Label htmlFor={`guided-${field.key}`}>{field.label}</Label>
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
      </Card>

      {/* Additional artefacts — v16 §2 MATERIAL-AWARE MODE */}
      <Card className="py-4">
        <button
          type="button"
          onClick={() => setMaterialsOpen((open) => !open)}
          aria-expanded={materialsOpen}
          aria-controls={materialsPanelId}
          className="flex w-full items-start justify-between gap-4 px-6 text-left"
        >
          <span className="min-w-0">
            <span className="block text-base font-semibold">{t.form.materialsTitle}</span>
            <span className="block text-sm text-muted-foreground">
              {t.form.materialsDescription}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform',
              materialsOpen && 'rotate-180',
            )}
          />
        </button>

          <div id={materialsPanelId} hidden={!materialsOpen} className="px-6 pt-4 space-y-4">
            {materials.length === 0 && (
              <p className="text-sm text-muted-foreground">{t.form.materialsHint}</p>
            )}

            {materials.map((material, index) => (
              <div key={index} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {t.form.materialRowTitle.replace('{n}', String(index + 1))}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMaterial(index)}
                    disabled={isLoading}
                    aria-label={`${t.form.removeMaterial} ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`material-label-${index}`}>{t.form.materialLabel}</Label>
                  <Input
                    id={`material-label-${index}`}
                    value={material.label}
                    placeholder={t.form.materialLabelPlaceholder}
                    onChange={(e) => updateMaterial(index, { label: e.target.value })}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`material-text-${index}`}>{t.form.materialText}</Label>
                  <Textarea
                    id={`material-text-${index}`}
                    value={material.text}
                    placeholder={t.form.materialTextPlaceholder}
                    onChange={(e) => updateMaterial(index, { text: e.target.value })}
                    className="min-h-[120px] resize-y"
                    disabled={isLoading}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
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
                      className="block w-full max-w-[260px] text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent disabled:pointer-events-none disabled:opacity-50"
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
            >
              <Plus className="mr-2 h-4 w-4" />
              {t.form.addMaterial}
            </Button>

            {fileError && (
              <p role="alert" className="text-sm text-severity-critical">
                {fileError}
              </p>
            )}
          </div>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleClear}
          disabled={isLoading}
        >
          Очистить
        </Button>
        <Button
          type="submit"
          disabled={!localInput.trim() || isLoading}
          className="min-w-[180px]"
        >
          {isLoading ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Анализируем...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Начать аудит
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
