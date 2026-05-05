'use client';

import * as React from 'react';
import { useAuditStateV2 } from '@/hooks/useAuditStateV2';
import { Button } from '@/components/ui/button';
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
import { Sparkles, BookOpen, Gamepad2, Eye, Dices } from 'lucide-react';
import type { MediaTypeV2 } from '@/lib/audit/types-v2';

// ─── Media type labels & icons ────────────────────────────────────────

const MEDIA_TYPE_OPTIONS: { value: MediaTypeV2; label: string; icon: React.ReactNode }[] = [
  { value: 'narrative', label: 'Нарратив', icon: <BookOpen className="h-4 w-4" /> },
  { value: 'game', label: 'Игра', icon: <Gamepad2 className="h-4 w-4" /> },
  { value: 'visual', label: 'Визуальное', icon: <Eye className="h-4 w-4" /> },
  { value: 'ttrpg', label: 'Настольная RPG', icon: <Dices className="h-4 w-4" /> },
];

// ─── Props ────────────────────────────────────────────────────────────

interface AuditFormV2Props {
  onSubmit: (input: { text: string; mediaType: MediaTypeV2 }) => void;
  isLoading?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────

export function AuditFormV2({ onSubmit, isLoading = false }: AuditFormV2Props) {
  const {
    inputText,
    setInputText,
    mediaType,
    setMediaType,
  } = useAuditStateV2();

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

    if (!localInput.trim()) return;

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
              <p className="text-xs text-muted-foreground">
                {localInput.length} символов
              </p>
              <p className="text-xs text-muted-foreground">
                Введите концепт — от пары предложений до целого рассказа. Длинные тексты обрабатываются автоматически.
              </p>
            </div>
          </div>

          {/* Media Type Selection */}
          <div className="space-y-2">
            <Label>Тип медиа</Label>
            <Select
              value={mediaType}
              onValueChange={(v) => setMediaType(v as MediaTypeV2)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите тип медиа" />
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
          className="min-w-[150px]"
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
