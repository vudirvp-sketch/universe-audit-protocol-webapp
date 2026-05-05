/**
 * UNIVERSE AUDIT PROTOCOL v11.0 — Type Definitions (Pipeline V2)
 *
 * Типы для нового 3-шагового пайплайна: markdown-ответы вместо JSON,
 * streaming, прогрессивный отчёт.
 *
 * Принцип: типы по контексту использования (CVA). Не God Object.
 */

// ============================================================
// Базовые типы (используются в нескольких местах)
// ============================================================

/** Тип медиа — определяет фильтрацию критериев из MASTER_CHECKLIST */
export type MediaTypeV2 = 'narrative' | 'game' | 'visual' | 'ttrpg';

/** Режим аудита */
export type AuditModeV2 = 'conflict' | 'kishō' | 'hybrid';

/** Входные данные пайплайна */
export interface AuditInput {
  text: string;
  mediaType: MediaTypeV2;
}

/** Конфигурация LLM-клиента */
export interface LLMConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  proxyUrl?: string;
  customContextWindow?: number;
  customMaxOutputTokens?: number;
}

/** Элемент чеклиста — минимальный контракт для промптов */
export interface ChecklistItemV2 {
  id: string;
  name: string;
  description: string;
  level: 'L1' | 'L2' | 'L3' | 'L4';
}

// ============================================================
// Результаты отдельных шагов пайплайна
// ============================================================

/** Результат Запроса 1: Знакомство + Скелет */
export interface Step1Result {
  auditMode: AuditModeV2;
  modeRationale: string;
  authorProfile: AuthorProfileV2;
  skeleton: SkeletonV2;
  screeningAnswers: ScreeningAnswer[];
  screeningFlags: string[];
}

/** Один ответ скрининга */
export interface ScreeningAnswer {
  question: string;
  passed: boolean;
  explanation: string;
}

/** Скелет концепта (8 элементов) */
export interface SkeletonV2 {
  thematicLaw: string | null;
  rootTrauma: string | null;
  hamartia: string | null;
  pillars: string[];
  emotionalEngine: string | null; // denial | anger | bargaining | depression | acceptance
  authorProhibition: string | null;
  targetExperience: string | null;
  centralQuestion: string | null;
}

/** Профиль автора */
export interface AuthorProfileV2 {
  type: 'gardener' | 'hybrid' | 'architect';
  percentage: number;
  confidence: number;
  risks: string[];
  auditPriorities: string[];
}

// ============================================================
// Результат Запроса 2: Оценка по критериям
// ============================================================

/** Результат Запроса 2: Оценка */
export interface Step2Result {
  assessments: CriterionAssessment[];
  griefMatrix: GriefArchitectureMatrixV2 | null;
}

/** Оценка одного критерия */
export interface CriterionAssessment {
  id: string;              // Совпадает с id из MASTER_CHECKLIST
  level: 'L1' | 'L2' | 'L3' | 'L4';
  verdict: 'strong' | 'weak' | 'insufficient_data';
  evidence: string;        // Цитата из текста или обоснование (до 30 слов)
  explanation: string;     // Почему так, а не иначе (1-2 предложения)
}

/**
 * Матрица архитектуры горя.
 * 5 стадий × 4 уровня материализации:
 * Персонаж + Локация + Механика/Действие + Акт
 */
export interface GriefArchitectureMatrixV2 {
  stages: GriefStageEntry[];
  dominantStage: string | null;
  acrossLevels: number;    // На скольких уровнях доминирующая стадия проявлена
}

/** Одна стадия в матрице горя */
export interface GriefStageEntry {
  stage: string;           // denial | anger | bargaining | depression | acceptance
  levels: {
    character: string;     // Персонаж, воплощающий стадию
    location: string;      // Локация, где стадия «живёт»
    mechanic: string;      // Механика/Действие = стадия
    act: string;           // Нарративный поворот (акт)
  };
}

// ============================================================
// Результат Запроса 3: Рекомендации
// ============================================================

/** Результат Запроса 3: Рекомендации */
export interface Step3Result {
  fixList: FixRecommendation[];
  whatForChains: ChainResultV2[];
  generative: GenerativeOutputV2 | null;
}

/** Рекомендация по исправлению */
export interface FixRecommendation {
  priority: number;        // 1 = самый важный
  criterionId: string;     // Ссылка на CriterionAssessment.id
  level: 'L1' | 'L2' | 'L3' | 'L4';
  diagnosis: string;       // Что не так
  fix: string;             // Что сделать
  approach: 'conservative' | 'compromise' | 'radical';
  effort: 'hours' | 'days' | 'weeks';
}

/** Цепочка «А чтобы что?» */
export interface ChainResultV2 {
  criterionId: string;
  chain: string[];         // 3-5 итераций «А чтобы что?»
  rootCause: string;       // Финальный вывод цепочки
}

/** Генеративные модули */
export interface GenerativeOutputV2 {
  griefMapping: string | null;   // Карта горя: как связать стадии с персонажами
  dilemma: string | null;        // Корнелианская дилемма для концепта
}

// ============================================================
// Обёртка пайплайна
// ============================================================

/** Состояние пайплайна v2 */
export interface PipelineStateV2 {
  phase: 'idle' | 'running' | 'done' | 'error';
  currentStep: 0 | 1 | 2 | 3;   // 0 = ещё не начат
  step1: Step1Result | null;
  step2: Step2Result | null;
  step3: Step3Result | null;
  meta: PipelineMeta;
  error: string | null;
}

/** Мета-информация пайплайна */
export interface PipelineMeta {
  inputText: string;
  mediaType: MediaTypeV2;
  narrativeDigest: string | null;
  elapsedMs: number;
  stepTimings: Record<string, number>;
  tokensUsed: { prompt: number; completion: number; total: number };
}

// ============================================================
// Экспорт
// ============================================================

/** Данные для экспорта отчёта */
export interface ExportData {
  report: AuditReportV2;
  exportedAt: string;      // ISO 8601
  protocolVersion: string; // '11.0'
}

/** Композитный отчёт для UI (только для рендера) */
export interface AuditReportV2 {
  step1: Step1Result;
  step2: Step2Result;
  step3: Step3Result;
  meta: PipelineMeta;
}

// ============================================================
// Streaming-коллбеки
// ============================================================

/** Коллбеки для streaming-пайплайна */
export interface StreamingCallbacks {
  /** Вызывается при смене шага (1→2→3) */
  onStepStart: (step: 1 | 2 | 3) => void;

  /** Вызывается при получении каждого чанка текста от LLM (streaming) */
  onChunk: (step: 1 | 2 | 3, text: string) => void;

  /** Вызывается при завершении шага с распарсенным результатом */
  onStepComplete: (step: 1 | 2 | 3, result: Step1Result | Step2Result | Step3Result) => void;

  /** Вызывается при фатальной ошибке */
  onError: (message: string) => void;
}

// ============================================================
// Промпт-типы
// ============================================================

/** Результат конструктора промпта */
export interface PromptSet {
  system: string;
  user: string;
}
