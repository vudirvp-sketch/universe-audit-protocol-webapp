'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface AuditProgressV2Props {
  currentStep: 0 | 1 | 2 | 3;
  streamingText: string;
  onCancel: () => void;
}

const STEPS = [
  { index: 1, label: 'Знакомство + Скелет' },
  { index: 2, label: 'Оценка по критериям' },
  { index: 3, label: 'Рекомендации' },
] as const;

function getStepStatus(
  stepIndex: number,
  currentStep: 0 | 1 | 2 | 3,
): 'waiting' | 'in_progress' | 'completed' {
  if (stepIndex < currentStep) return 'completed';
  if (stepIndex === currentStep) return 'in_progress';
  return 'waiting';
}

function StatusIcon({ status }: { status: 'waiting' | 'in_progress' | 'completed' }) {
  switch (status) {
    case 'in_progress':
      return <span className="text-lg leading-none" role="img" aria-label="В процессе">⏳</span>;
    case 'completed':
      return <span className="text-lg leading-none" role="img" aria-label="Завершено">✅</span>;
    case 'waiting':
      return <span className="text-lg leading-none" role="img" aria-label="Ожидание">⬜</span>;
  }
}

export function AuditProgressV2({ currentStep, streamingText, onCancel }: AuditProgressV2Props) {
  const preRef = React.useRef<HTMLPreElement>(null);

  // Auto-scroll streaming text to the bottom
  React.useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [streamingText]);

  const progressPercent = currentStep === 0 ? 0 : Math.round((currentStep / 3) * 100);

  const isAuditing = currentStep > 0 && currentStep <= 3;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Прогресс аудита v11.0</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Прогресс</span>
            <span>Шаг {Math.min(currentStep, 3)} из 3</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Step indicators */}
        <div className="space-y-1">
          {STEPS.map((step) => {
            const status = getStepStatus(step.index, currentStep);
            const isActive = status === 'in_progress';

            return (
              <div
                key={step.index}
                className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                  isActive ? 'bg-accent' : status === 'completed' ? 'opacity-70' : 'opacity-50'
                }`}
              >
                <StatusIcon status={status} />
                <span className="text-sm font-medium">{step.label}</span>
              </div>
            );
          })}
        </div>

        {/* Streaming text preview */}
        {isAuditing && streamingText && (
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">Потоковый ответ</span>
            <pre
              ref={preRef}
              aria-live="polite"
              className="max-h-48 overflow-y-auto rounded-md bg-muted/50 p-3 text-xs font-mono whitespace-pre-wrap break-words border"
            >
              {streamingText}
            </pre>
          </div>
        )}

        {/* Cancel button */}
        {isAuditing && (
          <div className="flex justify-end">
            <Button variant="destructive" size="sm" onClick={onCancel}>
              Отменить аудит
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
