/**
 * AuditReportView — Единый компонент для отображения полного отчёта v11.0.
 *
 * Прогрессивный рендеринг: секции появляются по мере поступления результатов.
 */

'use client';

import type { Step1Result, Step2Result, Step3Result, Skeleton, ScreeningAnswer, CriterionAssessment, GriefArchitectureMatrix, FixRecommendation, ChainResult, GenerativeOutput, PipelineMeta } from '@/lib/audit/types-v2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

// ============================================================
// Props
// ============================================================

interface AuditReportViewProps {
  step1: Step1Result | null;
  step2: Step2Result | null;
  step3: Step3Result | null;
  meta: PipelineMeta | null;
  streamingText?: string;
  isStreaming?: boolean;
  onExportMD?: () => void;
  onExportJSON?: () => void;
  onCopy?: () => void;
  onNewAudit?: () => void;
}

// ============================================================
// Main component
// ============================================================

export function AuditReportView({
  step1,
  step2,
  step3,
  meta,
  streamingText,
  isStreaming,
  onExportMD,
  onExportJSON,
  onCopy,
  onNewAudit,
}: AuditReportViewProps) {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Сводка + Скелет + Скрининг — доступны после Запроса 1 */}
      {step1 && (
        <>
          <SummarySection step1={step1} />
          <SkeletonSection skeleton={step1.skeleton} />
          <ScreeningSection answers={step1.screeningAnswers} />
        </>
      )}

      {/* Оценки L1-L4 — доступны после Запроса 2 */}
      {step2 ? (
        <AssessmentSection step2={step2} />
      ) : isStreaming && step1 ? (
        <StreamingPlaceholder text={streamingText || ''} label="Оценка по критериям..." />
      ) : null}

      {/* Рекомендации — доступны после Запроса 3 */}
      {step3 ? (
        <RecommendationsSection step3={step3} />
      ) : isStreaming && step2 ? (
        <StreamingPlaceholder text={streamingText || ''} label="Рекомендации..." />
      ) : null}

      {/* Мета-информация */}
      {meta && step1 && step2 && step3 && (
        <MetaSection meta={meta} />
      )}

      {/* Экспорт — только когда всё готово */}
      {step1 && step2 && step3 && (
        <div className="flex flex-wrap gap-3 justify-center py-4">
          {onExportMD && (
            <Button variant="outline" onClick={onExportMD}>
              📄 Скачать MD
            </Button>
          )}
          {onExportJSON && (
            <Button variant="outline" onClick={onExportJSON}>
              📋 Скачать JSON
            </Button>
          )}
          {onCopy && (
            <Button variant="outline" onClick={onCopy}>
              📎 Копировать
            </Button>
          )}
          {onNewAudit && (
            <Button variant="default" onClick={onNewAudit}>
              Новый аудит
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function SummarySection({ step1 }: { step1: Step1Result }) {
  const passedCount = step1.screeningAnswers.filter(a => a.passed).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Сводка</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">Режим:</span>
            <Badge variant="secondary">{getModeLabel(step1.auditMode)}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">Профиль автора:</span>
            <Badge variant="outline">
              {step1.authorProfile.type === 'gardener' ? 'Садовник' :
               step1.authorProfile.type === 'architect' ? 'Архитектор' : 'Гибрид'}
              {' '}{step1.authorProfile.percentage}%
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">Скрининг:</span>
            <span>{passedCount}/7 пройдено</span>
          </div>
          {step1.modeRationale && (
            <p className="text-muted-foreground mt-2">{step1.modeRationale}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonSection({ skeleton }: { skeleton: Skeleton }) {
  const items = [
    { label: 'Тематический закон', value: skeleton.thematicLaw },
    { label: 'Корневая травма', value: skeleton.rootTrauma },
    { label: 'Хамартия', value: skeleton.hamartia },
    { label: 'Столпы', value: skeleton.pillars.length > 0 ? skeleton.pillars.join('; ') : null },
    { label: 'Эмоциональный двигатель', value: skeleton.emotionalEngine },
    { label: 'Авторский запрет', value: skeleton.authorProhibition },
    { label: 'Целевой опыт', value: skeleton.targetExperience },
    { label: 'Центральный вопрос', value: skeleton.centralQuestion },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Скелет концепта</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          {items.map(item => (
            <div key={item.label} className="flex items-start gap-2">
              <span className="min-w-[180px] font-medium text-muted-foreground">{item.label}:</span>
              {item.value ? (
                <span>{item.value}</span>
              ) : (
                <span className="text-destructive">НЕ НАЙДЕНО</span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ScreeningSection({ answers }: { answers: ScreeningAnswer[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Скрининг</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-sm">
          {answers.map((answer, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-lg">{answer.passed ? '✅' : '❌'}</span>
              <div>
                <div className="font-medium">{answer.question}</div>
                <div className="text-muted-foreground">{answer.explanation}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AssessmentSection({ step2 }: { step2: Step2Result }) {
  const levels: Array<{ key: 'L1' | 'L2' | 'L3' | 'L4'; label: string }> = [
    { key: 'L1', label: 'L1: Механизм' },
    { key: 'L2', label: 'L2: Тело' },
    { key: 'L3', label: 'L3: Психика' },
    { key: 'L4', label: 'L4: Мета' },
  ];

  return (
    <>
      {levels.map(({ key, label }) => {
        const assessments = step2.assessments.filter(a => a.level === key);
        if (assessments.length === 0) return null;

        return (
          <Card key={key}>
            <CardHeader>
              <CardTitle>{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {assessments.map(a => (
                  <CriterionCard key={a.id} assessment={a} />
                ))}
              </div>
              {key === 'L3' && step2.griefMatrix && (
                <div className="mt-6">
                  <Separator className="my-4" />
                  <GriefMatrixCard matrix={step2.griefMatrix} />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}

function CriterionCard({ assessment }: { assessment: CriterionAssessment }) {
  const verdictConfig = {
    strong: { emoji: '🟢', label: 'СИЛЬНО', variant: 'default' as const },
    weak: { emoji: '🔴', label: 'СЛАБО', variant: 'destructive' as const },
    insufficient_data: { emoji: '⚪', label: 'НЕДОСТАТОЧНО ДАННЫХ', variant: 'secondary' as const },
  };

  const config = verdictConfig[assessment.verdict];

  return (
    <div className="border rounded-lg p-3 space-y-1">
      <div className="flex items-center gap-2">
        <span>{config.emoji}</span>
        <span className="font-medium">{assessment.id}</span>
        <Badge variant={config.variant}>{config.label}</Badge>
      </div>
      {assessment.evidence && (
        <p className="text-sm text-muted-foreground italic">&laquo;{assessment.evidence}&raquo;</p>
      )}
      {assessment.explanation && (
        <p className="text-sm">{assessment.explanation}</p>
      )}
    </div>
  );
}

function GriefMatrixCard({ matrix }: { matrix: GriefArchitectureMatrix }) {
  return (
    <div>
      <h4 className="font-semibold mb-2">Матрица архитектуры горя</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Стадия</th>
              <th className="text-left p-2">Персонаж</th>
              <th className="text-left p-2">Локация</th>
              <th className="text-left p-2">Механика</th>
              <th className="text-left p-2">Акт</th>
            </tr>
          </thead>
          <tbody>
            {matrix.stages.map(stage => (
              <tr key={stage.stage} className="border-b">
                <td className="p-2 font-medium">{stage.stage}</td>
                <td className="p-2">{stage.levels.character}</td>
                <td className="p-2">{stage.levels.location}</td>
                <td className="p-2">{stage.levels.mechanic}</td>
                <td className="p-2">{stage.levels.act}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {matrix.dominantStage && (
        <p className="text-sm text-muted-foreground mt-2">
          Доминирующая стадия: <strong>{matrix.dominantStage}</strong> (проявлена на {matrix.acrossLevels} из 4 уровней)
        </p>
      )}
    </div>
  );
}

function RecommendationsSection({ step3 }: { step3: Step3Result }) {
  return (
    <>
      {step3.fixList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Рекомендации (приоритизированные)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {step3.fixList.map(fix => (
                <FixCard key={fix.criterionId} fix={fix} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {step3.whatForChains.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Цепочки &laquo;А чтобы что?&raquo;</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {step3.whatForChains.map(chain => (
                <ChainCard key={chain.criterionId} chain={chain} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {step3.generative && (
        <Card>
          <CardHeader>
            <CardTitle>Генеративные модули</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {step3.generative.griefMapping && (
              <div>
                <h4 className="font-semibold mb-1">Карта горя</h4>
                <p className="text-sm whitespace-pre-wrap">{step3.generative.griefMapping}</p>
              </div>
            )}
            {step3.generative.dilemma && (
              <div>
                <h4 className="font-semibold mb-1">Корнелианская дилемма</h4>
                <p className="text-sm whitespace-pre-wrap">{step3.generative.dilemma}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

function FixCard({ fix }: { fix: FixRecommendation }) {
  const approachLabels = {
    conservative: 'Консервативный',
    compromise: 'Компромиссный',
    radical: 'Радикальный',
  };
  const effortLabels = {
    hours: 'часы',
    days: 'дни',
    weeks: 'недели',
  };

  return (
    <div className="border rounded-lg p-3 space-y-1">
      <div className="flex items-center gap-2">
        <Badge variant="outline">[{fix.level}]</Badge>
        <span className="font-medium">{fix.criterionId}</span>
        <span className="text-xs text-muted-foreground">{effortLabels[fix.effort]}</span>
      </div>
      <p className="text-sm"><strong>Диагноз:</strong> {fix.diagnosis}</p>
      <p className="text-sm"><strong>Исправление:</strong> {fix.fix}</p>
      <p className="text-xs text-muted-foreground">Подход: {approachLabels[fix.approach]}</p>
    </div>
  );
}

function ChainCard({ chain }: { chain: ChainResult }) {
  return (
    <div className="border-l-2 border-primary/30 pl-4">
      <h5 className="font-medium mb-1">{chain.criterionId}</h5>
      <div className="text-sm space-y-1">
        {chain.chain.map((step, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-muted-foreground">А чтобы что? →</span>
            <span>{step}</span>
          </div>
        ))}
        {chain.rootCause && (
          <div className="mt-2 font-medium">
            Корень: {chain.rootCause}
          </div>
        )}
      </div>
    </div>
  );
}

function MetaSection({ meta }: { meta: PipelineMeta }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Мета</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground space-y-1">
          <div>Токены: prompt={meta.tokensUsed.prompt}, completion={meta.tokensUsed.completion}, total={meta.tokensUsed.total}</div>
          <div>Время: {(meta.elapsedMs / 1000).toFixed(1)}с</div>
        </div>
      </CardContent>
    </Card>
  );
}

function StreamingPlaceholder({ text, label }: { text: string; label: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base animate-pulse">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {text && (
          <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-muted/50 p-3 rounded-md max-h-[400px] overflow-y-auto" aria-live="polite">
            {text}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

function getModeLabel(mode: string): string {
  switch (mode) {
    case 'conflict': return 'Конфликт';
    case 'kishō': return 'Кишō';
    case 'hybrid': return 'Гибрид';
    default: return mode;
  }
}
