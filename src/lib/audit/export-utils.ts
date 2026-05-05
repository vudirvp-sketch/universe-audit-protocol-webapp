/**
 * Export utilities for Universe Audit Protocol v11.0.
 *
 * Provides three export formats:
 * - Markdown (human-readable report)
 * - JSON (structured ExportData for programmatic consumption)
 * - Copy to clipboard (MD version)
 */

import type {
  AuditReportV2,
  ExportData,
  Step1Result,
  Step2Result,
  Step3Result,
  Skeleton,
  ScreeningAnswer,
  CriterionAssessment,
  GriefArchitectureMatrix,
  FixRecommendation,
  ChainResult,
  GenerativeOutput,
} from './types-v2';

// ============================================================
// Markdown Export
// ============================================================

/** Генерирует человекочитаемый markdown-отчёт из AuditReportV2 */
export function exportToMarkdown(report: AuditReportV2): string {
  const lines: string[] = [];

  lines.push('# Отчёт аудита — Universe Audit Protocol v11.0');
  lines.push('');

  // Сводка
  lines.push('## Сводка');
  lines.push('');
  const modeLabels: Record<string, string> = { conflict: 'Конфликт', kishō: 'Кишō', hybrid: 'Гибрид' };
  const profileLabels: Record<string, string> = { gardener: 'Садовник', hybrid: 'Гибрид', architect: 'Архитектор' };
  lines.push(`- **Режим:** ${modeLabels[report.step1.auditMode] || report.step1.auditMode}`);
  lines.push(`- **Профиль автора:** ${profileLabels[report.step1.authorProfile.type] || report.step1.authorProfile.type} ${report.step1.authorProfile.percentage}%`);
  const passedCount = report.step1.screeningAnswers.filter(a => a.passed).length;
  lines.push(`- **Скрининг:** ${passedCount}/7 пройдено`);
  if (report.step1.modeRationale) {
    lines.push(`- **Обоснование режима:** ${report.step1.modeRationale}`);
  }
  lines.push('');

  // Скелет концепта
  lines.push('## Скелет концепта');
  lines.push('');
  lines.push(formatSkeletonMD(report.step1.skeleton));
  lines.push('');

  // Скрининг
  lines.push('## Скрининг');
  lines.push('');
  for (const answer of report.step1.screeningAnswers) {
    lines.push(`- ${answer.passed ? '✅' : '❌'} **${answer.question}**: ${answer.explanation}`);
  }
  lines.push('');

  // Оценки L1–L4
  const levels: Array<{ key: 'L1' | 'L2' | 'L3' | 'L4'; label: string }> = [
    { key: 'L1', label: 'L1: Механизм' },
    { key: 'L2', label: 'L2: Тело' },
    { key: 'L3', label: 'L3: Психика' },
    { key: 'L4', label: 'L4: Мета' },
  ];

  for (const { key, label } of levels) {
    const assessments = report.step2.assessments.filter(a => a.level === key);
    if (assessments.length === 0) continue;

    lines.push(`## ${label}`);
    lines.push('');

    for (const a of assessments) {
      const verdictEmoji = a.verdict === 'strong' ? '🟢' : a.verdict === 'weak' ? '🔴' : '⚪';
      const verdictLabel = a.verdict === 'strong' ? 'СИЛЬНО' : a.verdict === 'weak' ? 'СЛАБО' : 'НЕДОСТАТОЧНО ДАННЫХ';
      lines.push(`- ${verdictEmoji} **${a.id}**: ${verdictLabel}`);
      if (a.evidence) lines.push(`  - Доказательство: «${a.evidence}»`);
      if (a.explanation) lines.push(`  - ${a.explanation}`);
    }

    // Grief matrix после L3
    if (key === 'L3' && report.step2.griefMatrix) {
      lines.push('');
      lines.push('### Матрица архитектуры горя');
      lines.push('');
      lines.push(formatGriefMatrixMD(report.step2.griefMatrix));
    }

    lines.push('');
  }

  // Рекомендации
  if (report.step3.fixList.length > 0) {
    lines.push('## Рекомендации (приоритизированные)');
    lines.push('');
    const approachLabels: Record<string, string> = { conservative: 'консервативный', compromise: 'компромиссный', radical: 'радикальный' };
    const effortLabels: Record<string, string> = { hours: 'часы', days: 'дни', weeks: 'недели' };
    for (const fix of report.step3.fixList) {
      lines.push(`${fix.priority}. **[${fix.level}] ${fix.criterionId}** (${effortLabels[fix.effort] || fix.effort})`);
      lines.push(`   - Диагноз: ${fix.diagnosis}`);
      lines.push(`   - Исправление: ${fix.fix}`);
      lines.push(`   - Подход: ${approachLabels[fix.approach] || fix.approach}`);
    }
    lines.push('');
  }

  // Цепочки «А чтобы что?»
  if (report.step3.whatForChains.length > 0) {
    lines.push('## Цепочки «А чтобы что?»');
    lines.push('');
    for (const chain of report.step3.whatForChains) {
      lines.push(`### ${chain.criterionId}`);
      for (const step of chain.chain) {
        lines.push(`- А чтобы что? → ${step}`);
      }
      if (chain.rootCause) {
        lines.push(`- **Корень:** ${chain.rootCause}`);
      }
      lines.push('');
    }
  }

  // Генеративные модули
  if (report.step3.generative) {
    lines.push('## Генеративные модули');
    lines.push('');
    if (report.step3.generative.griefMapping) {
      lines.push('### Карта горя');
      lines.push(report.step3.generative.griefMapping);
      lines.push('');
    }
    if (report.step3.generative.dilemma) {
      lines.push('### Корнелианская дилемма');
      lines.push(report.step3.generative.dilemma);
      lines.push('');
    }
  }

  // Мета
  lines.push('## Мета');
  lines.push('');
  lines.push(`- Токены: prompt=${report.meta.tokensUsed.prompt}, completion=${report.meta.tokensUsed.completion}, total=${report.meta.tokensUsed.total}`);
  lines.push(`- Время: ${(report.meta.elapsedMs / 1000).toFixed(1)}с`);

  return lines.join('\n');
}

// ============================================================
// JSON Export
// ============================================================

/** Сериализует отчёт в JSON-формат ExportData */
export function exportToJSON(report: AuditReportV2): string {
  const data: ExportData = {
    report,
    exportedAt: new Date().toISOString(),
    protocolVersion: '11.0',
  };
  return JSON.stringify(data, null, 2);
}

// ============================================================
// Helpers
// ============================================================

function formatSkeletonMD(skeleton: Skeleton): string {
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

  return items
    .map(item => `- **${item.label}:** ${item.value || 'НЕ НАЙДЕНО'}`)
    .join('\n');
}

function formatGriefMatrixMD(matrix: GriefArchitectureMatrix): string {
  const lines: string[] = [];
  lines.push('| Стадия | Персонаж | Локация | Механика | Акт |');
  lines.push('|--------|----------|---------|----------|-----|');
  for (const stage of matrix.stages) {
    lines.push(
      `| ${stage.stage} | ${stage.levels.character} | ${stage.levels.location} | ${stage.levels.mechanic} | ${stage.levels.act} |`
    );
  }
  if (matrix.dominantStage) {
    lines.push('');
    lines.push(`Доминирующая стадия: **${matrix.dominantStage}** (проявлена на ${matrix.acrossLevels} из 4 уровней)`);
  }
  return lines.join('\n');
}
